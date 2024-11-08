import "./style.css";

const app: HTMLDivElement = document.querySelector("#app")!;

const gameName = "GeoCacher!";
document.title = gameName;

const alertButton = document.createElement("button");
alertButton.innerHTML = "Get Alerted!";
app.append(alertButton);

//alert button added
alertButton.addEventListener("click", () => {
  alert("🚨 Button Pressed!! 🚨");
});
