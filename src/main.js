import LoadingScreen from './LoadingScreen';
import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { gsap } from 'gsap';
import * as CANNON from 'cannon';

import "@babylonjs/loaders/glTF";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";

const TOTAL_GROUNDS = 3;
const GROUND_LENGTH = 140;
const TOTAL_ROADS = 20;
const ROAD_LENGTH = 9.82;
const BARRIER_SPAWN_INTERVAL = 1200;
const LANES = [-0.925, 0, 0.925];
const SPEED = 8;

let scene,
  camera,
  speed = SPEED,
  isGameStarted = false,
  isGameOver = false,
  player,
  playerCollider,
  playerMesh,
  playerAnimGroups = {},
  grounds = [],
  earth,
  roadPrefab,
  roads = [],
  barrierPrefab,
  barriers = [],
  countdownText,
  currentLane = 1,
  score = 0,
  scoreText,
  isJumping = false;

function startGame() {
  const canvas = document.getElementById('renderCanvas');
  canvas.style.display = 'block';
  const engine = new BABYLON.Engine(canvas, true);
  engine.loadingScreen = new LoadingScreen();
  let loading = 0;

  const createScene = async function () {
    scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color3(0, 0, 0);
    // scene.debugLayer.show({
    //   overlay: true,
    // });

    camera = new BABYLON.ArcRotateCamera("camera", 0, 0, 0, new BABYLON.Vector3(0, 0, 0), scene);
    camera.setPosition(new BABYLON.Vector3(0, 1.5, -10));
    camera.target = new BABYLON.Vector3(0, 0, 15);
    // camera.attachControl(canvas, true);

    // light setup
    const light = new BABYLON.DirectionalLight("dir01", new BABYLON.Vector3(-2, -2, 1), scene);
    light.position = new BABYLON.Vector3(80, 120, 100);

    const ambientLight = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.5;

    // add fog
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
    scene.fogDensity = 0.03;
    scene.fogColor = new BABYLON.Color3(0, 0, 0);

    var postProcess = new BABYLON.ImageProcessingPostProcess("processing", 1.0, camera);
    postProcess.vignetteWeight = 3;
    postProcess.vignetteColor = new BABYLON.Color4(0, 0, 0, 0);
    postProcess.vignetteEnabled = true;

    scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), new BABYLON.CannonJSPlugin(true, 10, CANNON));

    if (!scene.isPhysicsEnabled()) {
      console.error("Physics not enabled!");
    }

    const audioEngine = await BABYLON.CreateAudioEngineAsync();
    const music = await BABYLON.CreateSoundAsync("music",
      "/background.mp3"
    );
    await audioEngine.unlockAsync();
    music.play({
      volume: 0.1,
      loop: true
    });

    loading += Math.random() * 0.05;
    engine.loadingScreen.updateProgress(loading * 100);

    // Earth
    const earthResult = await BABYLON.ImportMeshAsync("/earth.glb", scene);
    earth = earthResult.meshes[0];
    earth.position = new BABYLON.Vector3(0, -30, -5);
    earth.scaling = new BABYLON.Vector3(0.1, 0.1, 0.1);
    earth.rotation = new BABYLON.Vector3(0, 0, 0);
    earth.name = "earth";
    earth.setEnabled(false);

    gsap.to(earth.rotation, {
      y: Math.PI * 2,
      x: Math.PI * 2,
      z: Math.PI * 2,
      duration: 10,
      repeat: -1,
      ease: "linear"
    });


    loading += Math.random() * 0.1;
    engine.loadingScreen.updateProgress(loading * 100);

    // Ground management
    const groundMaterial = new BABYLON.StandardMaterial("ground", scene);
    groundMaterial.diffuseTexture = new BABYLON.Texture("/lunarrock_d.png");
    groundMaterial.specularTexture = new BABYLON.Texture("/lunarrock_s.png");
    groundMaterial.bumpTexture = new BABYLON.Texture("/lunarrock_n.png");
    groundMaterial.specularPower = 64;
    groundMaterial.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.05);

    const createGround = (zPos) => {
      const ground = BABYLON.MeshBuilder.CreateTiledGround("ground", {
        xmin: -100,
        zmin: -GROUND_LENGTH / 2,
        xmax: 100,
        zmax: GROUND_LENGTH / 2,
        subdivisions: { h: 40, w: 50 },
      }, scene);
      ground.name = "ground";
      ground.material = groundMaterial;
      ground.position.z = zPos;
      ground.physicsImpostor = new BABYLON.PhysicsImpostor(ground, BABYLON.PhysicsImpostor.BoxImpostor, {
        mass: 0,
        restitution: 0.1
      });
      return ground;
    };

    // Initialize grounds
    for (let i = 0; i < TOTAL_GROUNDS; i++) {
      const ground = createGround(i * GROUND_LENGTH);
      grounds.push(ground);
    }

    // Road management
    const roadResult = await BABYLON.ImportMeshAsync("/road.glb", scene);
    roadPrefab = roadResult.meshes[0];
    roadPrefab.setEnabled(false);

    loading += Math.random() * 0.2 + 0.2;
    engine.loadingScreen.updateProgress(loading * 100);

    const createRoad = async (zPos) => {
      const road = roadPrefab.clone("road");
      road.setEnabled(true);
      road.position = new BABYLON.Vector3(0, 0.002, zPos);
      road.rotation = new BABYLON.Vector3(Math.PI / 2, Math.PI / 2, 0);
      road.scaling = new BABYLON.Vector3(1, 1, 1);
      road.name = "road";
      return road;
    };

    // Initialize roads
    for (let i = 0; i < TOTAL_ROADS; i++) {
      const road = await createRoad(i * ROAD_LENGTH - ROAD_LENGTH);
      roads.push(road);
    }

    // Road Barrier management
    let lastBarrierSpawn = Date.now();

    const barrierResult = await BABYLON.ImportMeshAsync("/road_barrier.glb", scene);
    barrierPrefab = barrierResult.meshes[0];
    barrierPrefab.setEnabled(false);

    loading += Math.random() * 0.3 + 0.3;
    engine.loadingScreen.updateProgress(loading * 100);

    const createBarrier = (zPos) => {
      const xPos = LANES[Math.floor(Math.random() * LANES.length)];
      const barrier = barrierPrefab.clone("barrier");
      barrier.setEnabled(true);
      barrier.position = new BABYLON.Vector3(xPos, 0.16, zPos);
      barrier.scaling = new BABYLON.Vector3(0.4, 0.4, 0.4);
      barrier.rotation = new BABYLON.Vector3(0, Math.PI / 2, 0);
      barrier.name = "barrier";
      barrier.physicsImpostor = new BABYLON.PhysicsImpostor(barrier, BABYLON.PhysicsImpostor.BoxImpostor, {
        mass: 0,
      }, scene);
      return barrier;
    };

    // Player setup
    const playerResult = await BABYLON.ImportMeshAsync("/player.glb", scene);
    playerMesh = playerResult.meshes[0];
    player = playerMesh;
    player.position = new BABYLON.Vector3(0, -0.19, 0);
    player.scaling = new BABYLON.Vector3(0.6, 0.6, 0.6);
    player.rotation = new BABYLON.Vector3(0, 0, 0);
    player.name = "player";

    playerCollider = BABYLON.MeshBuilder.CreateBox("playerCollider", {
      width: 0.33,
      height: 0.3,
      depth: 0.3,
    }, scene);
    playerCollider.position = new BABYLON.Vector3(0, 0.7, -5);
    playerCollider.visibility = 0;
    playerCollider.physicsImpostor = new BABYLON.PhysicsImpostor(
      playerCollider,
      BABYLON.PhysicsImpostor.BoxImpostor,
      { mass: 1, restitution: 0.1, friction: 0.5 },
      scene
    );
    player.parent = playerCollider;

    loading += Math.random() * 0.4 + 0.4;
    engine.loadingScreen.updateProgress(loading * 100);

    // Player Animations
    playerResult.animationGroups.forEach(group => {
      playerAnimGroups[group.name.toLowerCase()] = group;
      group.stop();
    });
    playerAnimGroups["jump"].onAnimationEndObservable.add(() => {
      if (isGameOver) return;

      if (isJumping) {
        speed = SPEED;
        isJumping = false;
        playerAnimGroups["run"].start(true);
      }
    });
    playerAnimGroups["idle"].start(true);

    // Player Control
    window.addEventListener("keydown", (event) => {
      if (!player || isGameOver || !isGameStarted) return;

      // LEFT
      if ((event.key === "ArrowLeft" || event.key === "a") && currentLane > 0) {
        currentLane--;
      }

      // RIGHT
      if ((event.key === "ArrowRight" || event.key === "d") && currentLane < LANES.length - 1) {
        currentLane++;
      }

      // JUMP
      if (event.key === " " && !isJumping) {
        isJumping = true;
        playerAnimGroups["jump"]?.start(false, 1.0, playerAnimGroups["jump"].from, playerAnimGroups["jump"].to, false);

        const impulse = new BABYLON.Vector3(0, 3, 0);
        playerCollider.physicsImpostor.applyImpulse(impulse, playerCollider.getAbsolutePosition());
        speed = SPEED * 0.8;
      }
    });

    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    scoreText = new GUI.TextBlock();
    scoreText.text = "";
    scoreText.color = "white";
    scoreText.fontSize = 36;
    scoreText.fontFamily = "'Orbitron', sans-serif";
    scoreText.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    scoreText.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    scoreText.paddingTop = "10px";
    scoreText.paddingLeft = "10px";
    scoreText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    scoreText.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    advancedTexture.addControl(scoreText);

    countdownText = new GUI.TextBlock();
    countdownText.text = "";
    countdownText.color = "white";
    countdownText.fontSize = 120;
    countdownText.fontWeight = "bold";
    countdownText.outlineColor = "black";
    countdownText.outlineWidth = 4;
    countdownText.fontFamily = "'Orbitron', sans-serif";
    countdownText.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    countdownText.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    advancedTexture.addControl(countdownText);

    gsap.to(countdownText, {
      paddingTop: "20px",
      duration: 0.5,
      ease: "power2.inOut",
      repeat: -1,
      yoyo: true,
    });

    scene.registerBeforeRender(() => {
      if (!isGameStarted) return;
      if (isGameOver) return;

      let deltaTime = engine.getDeltaTime() / 1000;
      deltaTime = Math.min(deltaTime, 0.05);

      // Move grounds
      let groundMaxZ = Math.max(...grounds.map(g => g.position.z));
      grounds.forEach(ground => {
        ground.position.z -= speed * deltaTime;
        ground.physicsImpostor.setDeltaPosition(ground.position);

        if (ground.position.z < -GROUND_LENGTH) {
          ground.position.z = groundMaxZ + GROUND_LENGTH - (speed * deltaTime);
          groundMaxZ = ground.position.z;
        }
      });

      // Move roads
      let roadMaxZ = Math.max(...roads.map(r => r.position.z));
      roads.forEach((road) => {
        road.position.z -= speed * deltaTime;

        if (road.position.z < -2 * ROAD_LENGTH) {
          road.position.z = roadMaxZ + ROAD_LENGTH - (speed * deltaTime);
          roadMaxZ = road.position.z;
        }
      });

      // Spawn barriers
      if (Date.now() - lastBarrierSpawn > BARRIER_SPAWN_INTERVAL) {
        let barrier = createBarrier(70);
        barriers.push(barrier);
        lastBarrierSpawn = Date.now();
      }

      // Move barriers
      barriers.forEach((barrier, index) => {
        barrier.position.z -= speed * deltaTime;
        if (barrier.position.z < -15) {
          barrier.dispose();
          barriers.splice(index, 1);

          score += Math.floor(Math.random() * 10) + 1;
          scoreText.text = `Score: ${score}`;

          if (score >= 200) {
            isGameOver = true;
            playerAnimGroups["victory"]?.start(true);

            setTimeout(() => {
              playerAnimGroups["flying"].start(true);

              grounds.forEach(ground => {
                ground.dispose();
              });
              roads.forEach(road => {
                road.dispose();
              });
              barriers.forEach(barrier => {
                barrier.dispose();
              });
              scoreText.dispose();
              earth.setEnabled(true);
              earth.physicsImpostor = new BABYLON.PhysicsImpostor(earth, BABYLON.PhysicsImpostor.BoxImpostor, {
                mass: 0,
                restitution: 0.1
              }, scene);
              playerCollider.physicsImpostor.setLinearVelocity(new BABYLON.Vector3(0, 0, 0));

              camera.parent = playerCollider;
              camera.position = new BABYLON.Vector3(0, 2, -5);
              camera.rotation = new BABYLON.Vector3(0, Math.PI, 0);

              // add text at center and say You are falling on the earth
              const messageText = new GUI.TextBlock();
              messageText.text = "You are falling on the earth!";
              messageText.color = "white";
              messageText.fontSize = 70;
              messageText.fontWeight = "bold";
              messageText.outlineColor = "black";
              messageText.outlineWidth = 4;
              messageText.fontFamily = "'Orbitron', sans-serif";
              messageText.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
              messageText.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
              messageText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
              messageText.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
              advancedTexture.addControl(messageText);


              gsap.to(camera, {
                radius: 55,
                duration: 2,
                ease: "power2.inOut"
              });

              setTimeout(() => {
                messageText.dispose();
                playerCollider.physicsImpostor.setMass(0);

                // add congratulations text
                const congratsText = new GUI.TextBlock();
                congratsText.text = "Congratulations!";
                congratsText.color = "white";
                congratsText.fontSize = 90;
                congratsText.fontWeight = "bold";
                congratsText.outlineColor = "black";
                congratsText.outlineWidth = 4;
                congratsText.fontFamily = "'Orbitron', sans-serif";
                congratsText.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
                congratsText.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
                congratsText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
                congratsText.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
                advancedTexture.addControl(congratsText);
                gsap.to(congratsText, {
                  alpha: 0,
                  duration: 2,
                  ease: "power2.inOut"
                });

                setTimeout(() => {
                  engine.stopRenderLoop();
                  document.getElementById("renderCanvas").style.display = "none";
                  document.getElementById("gameOverScreen").style.display = "block";
                  document.getElementById("message").innerText = "Game Won!\nYou are on the earth!";
                }, 1500);
              }, 2400);
            }, 3000);
          }
        }
      });

      if (player && playerCollider) {
        const currentX = playerCollider.position.x;
        const targetX = LANES[currentLane];
        const deltaX = targetX - currentX;

        // Apply simple lerp or direct assignment
        playerCollider.position.x += deltaX * 0.2; // Smooth slide
        playerCollider.physicsImpostor.setAngularVelocity(new BABYLON.Vector3(0, 0, 0));
      }

      if (!isGameOver) {
        barriers.forEach((barrier, index) => {
          if (!isGameOver && barrier.intersectsMesh(playerCollider, false)) {
            isGameOver = true;

            Object.keys(playerAnimGroups).forEach(key => {
              playerAnimGroups[key].stop();
            });
            playerAnimGroups["death"]?.start(false, 1.0, playerAnimGroups["death"].from, playerAnimGroups["death"].to, false);

            setTimeout(() => {
              engine.stopRenderLoop();

              document.getElementById("renderCanvas").style.display = "none";
              document.getElementById("gameOverScreen").style.display = "block";
              document.getElementById("message").innerText = `Game Over!\nYour Score: ${score}`;
            }, 1200);
          }
        });
      }
    });

    engine.loadingScreen.updateProgress(100);

    return scene;
  };

  createScene().then((scene) => {
    engine.loadingScreen.hideLoadingUI();

    const doCountdown = async () => {
      const countdowns = ["3", "2", "1", "READY!"];
      for (let i = 0; i < countdowns.length; i++) {
        countdownText.text = countdowns[i];
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      countdownText.dispose();
      score = 0;
      scoreText.text = `Score: ${score}`;
      isGameStarted = true;
      playerAnimGroups["idle"].stop();
      playerAnimGroups["run"]?.start(true);
    };
    doCountdown();

    engine.runRenderLoop(() => scene.render());
    window.addEventListener("resize", () => engine.resize());
  });
}

let btn = document.getElementById('startBtn');
btn.addEventListener('click', () => {
  document.getElementById('main').style.display = 'none';
  document.getElementById('loadingScreen').style.display = 'block';
  startGame();
});