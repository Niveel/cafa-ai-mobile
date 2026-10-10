/**
 * Movie Studio credit top-ups sit behind a flag. Selling digital credits in an
 * iOS/Android app can fall under Apple / Google in-app-purchase rules; the
 * owner has not decided yet. Set EXPO_PUBLIC_MOVIE_STUDIO_TOPUP=0 to switch
 * the in-app purchase off (the sheet then explains where to top up).
 */
export const MOVIE_STUDIO_TOPUP_ENABLED = process.env.EXPO_PUBLIC_MOVIE_STUDIO_TOPUP !== '0';
