document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("streamers");

  document.getElementById("loginTwitch").addEventListener("click", async () => {
    await browser.runtime.sendMessage({ type: "loginTwitch" });
    container.innerText = "Twitch login complete.";
  });

  document.getElementById("loginYouTube").addEventListener("click", async () => {
    await browser.runtime.sendMessage({ type: "loginYouTube" });
    container.innerText = "YouTube login complete.";
  });

  setTimeout(async () => {
    const response = await browser.runtime.sendMessage({ type: "getData" });
    container.innerHTML = "";

    if (response.error) {
      container.innerText = response.error;
      return;
    }

    [...response.twitch, ...response.youtube].forEach(streamer => {
      const div = document.createElement("div");
      div.className = "streamer";
      div.innerText = `[${streamer.platform}] ${streamer.name}`;
      container.appendChild(div);
    });
  }, 3000);
});