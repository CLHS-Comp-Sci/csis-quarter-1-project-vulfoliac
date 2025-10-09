// redirectUri is important for evil reasons
const redirectUri = browser.identity.getRedirectURL();

// creates empty cache to store streamers
let twitchDataCache = [];
// used to id the app
const twitchClientId = "usja5so2e3x52l2fsg4cd6peagl06u";
const twitchScopes = "user:read:follows";

// when the user clicks on the login button it prompts them to login to a twitch acc
async function twitchLogin() {
    // a try catch statement that allows the user to switch twitch accounts by clicking the login with twitch button a second time
    // even if they are already logged in 
    try {
        const {
            twitchToken
        } = await browser.storage.local.get("twitchToken");
        if (twitchToken) {
            await fetch("https://id.twitch.tv/oauth2/revoke", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: `client_id=${encodeURIComponent(twitchClientId)}&token=${encodeURIComponent(twitchToken)}`
            }).catch(() => {});
            await browser.storage.local.remove("twitchToken");
        }
    } catch (err) {
        console.error("Twitch Logout failed:", err);
    }

    // constructs the url we need to ask for authorization contains:
    // our identity
    // the link to send the user to when they are done
    // 
    // the scopes we are requesting
    // and a clause to ensure the user has to confirm instead of automatically logging them in
    const authUrl =
        `https://id.twitch.tv/oauth2/authorize?` +
        `client_id=${twitchClientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent(twitchScopes)}` +
        `&force_verify=true`;

    // the url 
    try {
        const responseUrl = await browser.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        });

        console.log("Twitch Response URL:", responseUrl);

        const m = responseUrl.match(/access_token=([^&]+)/);
        if (m) {
            const accessToken = m[1];
            console.log("Twitch Access Token:", accessToken);
            await browser.storage.local.set({
                twitchToken: accessToken
            });

            const followsData = await fetchTwitchStreamers(accessToken);
            browser.runtime.sendMessage({
                twitchData: followsData
            });
        } else {
            console.error("No Twitch Token Found in Redirect.");
        }
    } catch (err) {
        console.error("Twitch login failed:", err);
    }
}

async function fetchTwitchStreamers(accessToken) {
    const userResponse = await fetch("https://api.twitch.tv/helix/users", {
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Client-Id": twitchClientId
        }
    });

    const userData = await userResponse.json();
    const userId = userData.data[0].id;

    const followsResponse = await fetch(`https://api.twitch.tv/helix/channels/followed?user_id=${userId}`, {
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Client-Id": twitchClientId
        }
    })

    const followsData = await followsResponse.json();
    twitchDataCache = followsData.data.map(s => ({
        platform: "Twitch",
        name: s.broadcaster_name
    }));
    console.log("Twitch Streamers:", twitchDataCache);
    return followsData;
}

let youtubeDataCache = [];
const youtubeClientId = "442245912187-9gr180k35aetgvmdmog8flkcte0316m8.apps.googleusercontent.com";
const youtubeScopes = "https://www.googleapis.com/auth/youtube.readonly";

async function youtubeLogin() {

    try {
        const {
            youtubeToken
        } = await browser.storage.local.get("youtubeToken");
        if (youtubeToken) {
            await fetch("https://oauth2.googleapis.com/revoke", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: `token=${encodeURIComponent(youtubeToken)}`
            }).catch(() => {});
            await browser.storage.local.remove("youtubeToken");
        }
    } catch (_) {}

    const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${youtubeClientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent(youtubeScopes)}` +
        `&access_type=online` +
        `&include_granted_scopes=false` +
        `&prompt=${encodeURIComponent("consent select_account")}`;

    try {
        const responseUrl = await browser.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        });

        console.log("YouTube Response URL:", responseUrl);

        const m = responseUrl.match(/access_token=([^&]+)/);
        if (m) {
            const accessToken = m[1];
            console.log("YouTube Access Token:", accessToken);
            await browser.storage.local.set({
                youtubeToken: accessToken
            });

            const data = await fetchYouTubeStreamers(accessToken);
            await browser.storage.local.set({
                youtubeData: youtubeDataCache
            });
        } else {
            console.error("No YouTube token found in redirect.");
        }
    } catch (err) {
        console.error("YouTube login failed:", err);
    }
}

async function fetchYouTubeStreamers(accessToken) {
    const response = await fetch("https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=20", {
        headers: {
            "Authorization": `Bearer ${accessToken}`
        }
    });

    if (response.status === 401) {
        console.warn("Youtube token expired or something along those lines");
        await loginYouTube();
        return;
    }

    const data = await response.json();
    youtubeDataCache = (data.items || []).map(s => ({
        platform: "YouTube",
        name: s.snippet.title
    }));
    console.log("YouTube Streamers:", youtubeDataCache);
    return data;
}

browser.runtime.onMessage.addListener(async (msg) => {
    if (msg.type === "twitchLogin") await twitchLogin();
    if (msg.type === "youtubeLogin") await youtubeLogin();

    if (msg.type === "getData") {
        const {
            twitchToken,
            youtubeToken
        } = await browser.storage.local.get(["twitchToken", "youtubeToken"]);

        if (twitchToken && twitchDataCache.length === 0) {
            await fetchTwitchStreamers(twitchToken);
        }
        if (youtubeToken && youtubeDataCache.length === 0) {
            await fetchYouTubeStreamers(youtubeToken);
        }

        return Promise.resolve({
            twitch: twitchDataCache,
            youtube: youtubeDataCache
        });
    }
});
