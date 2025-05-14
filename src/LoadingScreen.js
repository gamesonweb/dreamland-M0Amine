export default class LoadingScreen {
  constructor() {
    this._loadingDiv = document.getElementById("loadingScreen");
    this._loadingDivProgress = document.getElementById("loadingProgress");
  }

  displayLoadingUI() {
    this._loadingDiv.style.display = "initial";
    this._loadingDivProgress.style.width = "0px";
  }

  hideLoadingUI() {
    this._loadingDiv.style.display = "none";
  }

  loadingUIVisible() {
    return this._loadingDiv.style.display == "initial";
  }

  updateProgress(value) {
    if (value >= 100) {
      value = 100;
    }

    this._loadingDivProgress.style.width = value + "%";
  }
}