// Remove this later it's just so I can get setup
console.log("Redirect URI:", browser.identity.getRedirectURL());

const twitchClientId = "gp762nuuoqcoxypju8c569th9wz7q5";
const youtubeClientId = "442245912187-9gr180k35aetgvmdmog8flkcte0316m8.apps.googleusercontent.com";

const twitchScopes = "user:read:follows";
const youtubeScopes = "https://www.googleapis.com/auth/youtube.readonly";

async function loginTwitch() {
  const redirectUri = browser.identity.getRedirectURL();
  console.log("Twitch redirect URI:", redirectUri);

  const authUrl =
    `https://id.twitch.tv/oauth2/authorize?` +
    `client_id=${twitchClientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent(twitchScopes)}`;

  try {
    const responseUrl = await browser.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });

    console.log("Twitch response URL:", responseUrl);

    const m = responseUrl.match(/access_token=([^&]+)/);
    if (m) {
      const accessToken = m[1];
      console.log("Twitch Access Token:", accessToken);
      await browser.storage.local.set({ twitchToken: accessToken });
    } else {
      console.error("No Twitch token found in redirect.");
    }
  } catch (err) {
    console.error("Twitch login failed:", err);
  }
}

async function loginYouTube() {
  const redirectUri = browser.identity.getRedirectURL();
  console.log("YouTube redirect URI:", redirectUri);

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${youtubeClientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent(youtubeScopes)}` +
    `&include_granted_scopes=true`;

  try {
    const responseUrl = await browser.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });

    console.log("YouTube response URL:", responseUrl);

    const m = responseUrl.match(/access_token=([^&]+)/);
    if (m) {
      const accessToken = m[1];
      console.log("YouTube Access Token:", accessToken);
      await browser.storage.local.set({ youtubeToken: accessToken });
    } else {
      console.error("No YouTube token found in redirect.");
    }
  } catch (err) {
    console.error("YouTube login failed:", err);
  }
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === "loginTwitch") {
    loginTwitch();
  }
  if (msg.type === "loginYouTube") {
    loginYouTube();
  }
});