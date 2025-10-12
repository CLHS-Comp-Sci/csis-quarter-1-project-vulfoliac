const now = new Date();
console.log(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);

const redirectUri = browser.identity.getRedirectURL();

let twitchDataCache = [];
const twitchClientId = "usja5so2e3x52l2fsg4cd6peagl06u";
const twitchScopes = "user:read:follows";

async function twitchLogin() {
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

    const authUrl =
        `https://id.twitch.tv/oauth2/authorize?` +
        `client_id=${twitchClientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent(twitchScopes)}` +
        `&force_verify=true`;

    try {
        const responseUrl = await browser.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        });

        const m = responseUrl.match(/access_token=([^&]+)/);
        if (m) {
            const accessToken = m[1];
            await browser.storage.local.set({
                twitchToken: accessToken
            });

            const followsData = await fetchTwitchStreamers(accessToken);
            browser.runtime.sendMessage({
                twitchData: followsData
            });
        } else {
            console.error("no access token");
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

    twitchDataCache = await Promise.all(
        followsData.data.map(async s=> {
            const isLive = await checkTwitchLive(accessToken, s.broadcaster_login);
            return {
                live: isLive,
                name: s.broadcaster_name,
                platform: "Twitch",
                url: `https://www.twitch.tv/${s.broadcaster_login}`,
                game: s.game_name
            }
        })
    )
    return twitchDataCache;
}

async function checkTwitchLive(accessToken, loginName) {
    const response = await fetch(`https://api.twitch.tv/helix/streams?user_login=${loginName}`, {
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Client-Id": twitchClientId
        }
    });

    if (!response.ok) {
        console.error("Twitch live check failed:", response.status, await response.text());
        return false;
    }

    const data = await response.json();
    return data.data && data.data.length > 0;
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

        //console.log("YouTube Response URL:", responseUrl);

        const m = responseUrl.match(/access_token=([^&]+)/);
        if (m) {
            const accessToken = m[1];
            await browser.storage.local.set({
                youtubeToken: accessToken
            });

            //console.log("YouTube Access Token:", accessToken);

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
    const response = await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=20`, {
        headers: {
            "Authorization": `Bearer ${accessToken}`
        }
    });

    if (response.status === 401) {
        console.warn("Youtube token expired or something along those lines");
        await youtubeLogin();
        return;
    }

    if (response.status === 403) {
        console.warn("You have used your daily quota (called the api too many times)")
        return;
    }

    const data = await response.json();

    console.log(data);

    youtubeDataCache = await Promise.all(
        (data.items || []).map(async s=> {
            const channelId = s.snippet.resourceId.channelId;
            const isLive = await checkYouTubeLive(accessToken, channelId);
            return {
                live: isLive,
                name: s.snippet.title,
                platform: "YouTube",
                url: `https://www.youtube.com/channel/${channelId}`
            };
        })
    );

    return youtubeDataCache;
}

async function checkYouTubeLive(accessToken, channelId) {
    const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&eventType=live`,
    { headers: { "Authorization": `Bearer ${accessToken}` } }
  );

  const data = await response.json();
  return data.items && data.items.length > 0;
}

browser.runtime.onMessage.addListener(async (msg) => {
    if (msg.type === "twitchLogin") await twitchLogin();
    if (msg.type === "youtubeLogin") await youtubeLogin();

    if (msg.type === "getData") {
        //console.log("-------------------- calling api --------------------");
        const {
            twitchToken,
            youtubeToken
        } = await browser.storage.local.get(["twitchToken", "youtubeToken"]);

        const twitchData = twitchToken ? await fetchTwitchStreamers(twitchToken) : [];
        const youtubeData = youtubeToken ? await fetchYouTubeStreamers(youtubeToken) : [];

        return Promise.resolve({
            twitch: twitchData,
            youtube: youtubeData
        });
    }
    else {
        updateDisplay(msg);
    }
});
