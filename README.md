# Cafa AI

Mobile scaffold aligned to `cafa_ai_web` with:
- Expo Router (`(auth)` + `(drawer)` route groups)
- Typed feature modules (`features/auth`, `features/chat`, `features/images`, `features/videos`, `features/voice`, `features/billing`, `features/settings`)
- API layer (`services/api`) with endpoints + auth interceptor foundation
- Session storage foundation (`expo-secure-store`)
- Accessible custom drawer shell with chat search, top actions, and account card
- TypeScript and NativeWind utilities

## Run

```bash
npm install
npm run start
```

## Notes

- `app/(drawer)` is the main product shell (Chat, Images, Videos, Voice, Plans, Settings).
- `app/(auth)` contains auth flow scaffolds (login, signup, verify OTP, forgot/reset password).
- `docs/CAFA_AI_MOBILE_BUILD_GUIDE.md` is the implementation blueprint for feature-by-feature parity with web.
