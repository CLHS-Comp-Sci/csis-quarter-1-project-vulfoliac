globalStreamerList = [];

const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
document.documentElement.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);

const debounce = (callback, wait) => {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback(...args);
    }, wait);
  };
}

async function createStreamerList(response) {
    const container = document.getElementById("streamers");
    if (response instanceof Promise) { response = await response; }

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

    globalStreamerList = allStreamers;

    if (allStreamers.length === 0) {
        container.innerText = "You follow no one";
        return;
    }

    updateDisplay(allStreamers);

}

function updateDisplay(allStreamers) {
    const container = document.getElementById("streamers");
    container.innerHTML = "";

    allStreamers.sort((a, b) => {
        if (a.live !== b.live) return a.live ? -1 : 1;

        if (a.platform !== b.platform) {
            return a.platform.toLowerCase() === "Twitch" ? 1 : -1;
        }

        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    })

    allStreamers.forEach((streamer) => {
        //console.log(streamer);
        const div = document.createElement("div");
        div.className = `streamer ${streamer.platform.toLowerCase()}`;
        // div.innerText = `[${streamer.platform}] ${streamer.name}`;

        const icon = document.createElement("img");
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

        const query = document.getElementById("searchbar").value.toLowerCase();
        if (query && streamer.name.toLowerCase().includes(query)) {
            const regex = new RegExp(`(${query})`, "gi");
            link.innerHTML = streamer.name.replace(regex, "<mark>$1</mark>");
        } else {
            link.textContent = streamer.name;
        }

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

function filter(search) {
    let query = "";

    if (search && search.target) {
        query = search.target.value.toLowerCase().trim();
    } else if (typeof search === "string") {
        query = search.toLowerCase().trim();
        const ui = document.getElementById("searchbar");
        if (ui) ui.value = search;
    }

    if (query.length === 0 || !query) {
        updateDisplay(globalStreamerList);
        browser.storage.local.remove("lastQuery");
        return;
    }
        
    
    browser.storage.local.set({ lastQuery: query});

    const container = document.getElementById("streamers");
    container.innerHTML = "Searching...";

    const filtered = globalStreamerList.filter((streamer) =>
        streamer.name.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
        container.innerText = `No streamers found including: "${query}"`
        return;
    }

    updateDisplay(filtered);
} 

function clearQuery() {
    const searchbar = document.getElementById("searchbar");
    searchbar.value = "";
    browser.storage.local.remove("lastQuery");
    updateDisplay(globalStreamerList);
}

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
        createStreamerList(response);
    });

    document.getElementById("youtubeLogin").addEventListener("click", async () => {
        await browser.runtime.sendMessage({
            type: "youtubeLogin"
        });
        container.innerText = "YouTube login complete. Fetching data give me a second";

        const response = await browser.runtime.sendMessage({
            type: "getData"
        });
        createStreamerList(response);
    });

    const response = await browser.runtime.sendMessage({
        type: "getData"
    })
    
    createStreamerList(response);

    const temp = await browser.storage.local.get("lastQuery")
    const lastQuery = temp.lastQuery;

    const ui = document.getElementById("searchbar");

    if (lastQuery && lastQuery.length > 0) {
        ui.value = lastQuery;
        filter(lastQuery)
    }

});

// Update filter from search bar with debounce
document.getElementById("searchbar").addEventListener("input", debounce((search) => {
    filter(search);
}, 300));

// searchbar ux
document.getElementById("searchbar").addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Backspace") {

        const searchbar = e.target;

        if (searchbar.value.trim().length > 0) {
            clearQuery();
        } else {
            searchbar.blur();
        }
    }
});

// refresh streamers (maybe I will add a fun button later)
document.addEventListener("keydown", (e) => {
    if (e.key === "r") { browser.runtime.sendMessage({ type: "getData" }); }
});

// Clear query button!
document.getElementById("clearQuery").addEventListener("click", clearQuery);