document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("streamers");

    document.getElementById("twitchLogin").addEventListener("click", async () => {
        await browser.runtime.sendMessage({
            type: "twitchLogin"
        });
        container.innerText = "Twitch login complete. Fetching data wait wait wait wait wait wait stop rushing me";

        const response = await browser.runtime.sendMessage({
            type: "getData"
        });
        updateDisplay(response);
    });

    document.getElementById("youtubeLogin").addEventListener("click", async () => {
        await browser.runtime.sendMessage({
            type: "youtubeLogin"
        });
        container.innerText = "YouTube login complete. Fetching data give me a second";

        const response = await browser.runtime.sendMessage({
            type: "getData"
        });
        updateDisplay(response);
    });

    browser.runtime.sendMessage({
        type: "getData"
    }).then((response) => {
        updateDisplay(response);
    });


    function updateDisplay(response) {
        const container = document.getElementById("streamers");

        if (!response) return;
        container.innerHTML = "";

        if (response.error) {
            container.innerText = response.error;
            return;
        }

        const allStreamers = [
            ...(response.twitch || []),
            ...(response.youtube || []),
        ];

        if (allStreamers.length === 0) {
            container.innerText = "You follow no one";
            return;
        }

        allStreamers.sort((a, b) => {
            if (a.live !== b.live) return a.live ? -1 : 1;

            if (a.platform !== b.platform) {
                if (a.platform === "Twitch" && b.platform === "YouTube") return -1;
            }

            return a.name.localeCompare(b.name);
        })

        allStreamers.forEach((streamer) => {
            const div = document.createElement("div");
            div.className = `streamer ${streamer.platform.toLowerCase()}`;
            // div.innerText = `[${streamer.platform}] ${streamer.name}`;

            const icon= document.createElement("img");
            if (streamer.platform === "Twitch") {
                icon.src = "icons/twitch.png";
                icon.alt = "Twitch";
            } else if (streamer.platform === "YouTube") {
                icon.src = "icons/youtube.png";
                icon.alt = "YouTube";
            }
            icon.className = "platform-icon";

            const link = document.createElement("a");
            link.href = streamer.url; // the destination
            link.textContent = streamer.name; // what it looks like
            link.target = "_blank" // it will open in a new tab
            link.rel = "noopener noreferrer"; //disallows the site we are opening to edit the extension or know how it was opened

            div.appendChild(icon);
            div.appendChild(link);

            if (streamer.live) {
                const liveBadge = document.createElement("span");
                liveBadge.textContent = "LIVE NOW";
                liveBadge.className = "live-badge";
                div.appendChild(liveBadge);
            }

            container.appendChild(div);
        });
    }
});
