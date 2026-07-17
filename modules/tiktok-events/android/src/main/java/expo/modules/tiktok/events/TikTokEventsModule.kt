package expo.modules.tiktok.events

import com.tiktok.TikTokBusinessSdk
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class TikTokEventsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TikTokEvents")

    Function("isInitialized") {
      TikTokBusinessSdk.isInitialized()
    }

    AsyncFunction("initialize") { appId: String, trackingEnabled: Boolean, debug: Boolean ->
      require(appId.isNotBlank()) { "TikTok App ID must not be empty." }

      if (!TikTokBusinessSdk.isInitialized()) {
        val context = requireNotNull(appContext.reactContext?.applicationContext) {
          "Android application context is unavailable."
        }
        val config = TikTokBusinessSdk.TTConfig(context)
          .setAppId(appId)
          .setTTAppId(appId)
          .disableAutoIapTrack()
          .setLogLevel(if (debug) TikTokBusinessSdk.LogLevel.DEBUG else TikTokBusinessSdk.LogLevel.NONE)

        if (!trackingEnabled) config.disableAutoStart()
        TikTokBusinessSdk.initializeSdk(config)
      }

      if (trackingEnabled) TikTokBusinessSdk.startTrack()
      TikTokBusinessSdk.isInitialized()
    }

    Function("startTracking") {
      check(TikTokBusinessSdk.isInitialized()) { "TikTok SDK has not been initialized." }
      TikTokBusinessSdk.startTrack()
    }

    Function("disableTracking") {
      if (TikTokBusinessSdk.isInitialized()) {
        TikTokBusinessSdk.clearAll()
        TikTokBusinessSdk.destroy()
      }
    }

    Function("trackEvent") { name: String, properties: Map<String, Any?>, eventId: String? ->
      check(TikTokBusinessSdk.isInitialized()) { "TikTok SDK has not been initialized." }
      require(name.isNotBlank()) { "TikTok event name must not be empty." }

      val json = JSONObject()
      properties.forEach { (key, value) -> json.put(key, value ?: JSONObject.NULL) }
      if (eventId.isNullOrBlank()) {
        TikTokBusinessSdk.trackEvent(name, json)
      } else {
        TikTokBusinessSdk.trackEvent(name, json, eventId)
      }
    }

    Function("identify") { externalId: String, userName: String?, phone: String?, email: String? ->
      check(TikTokBusinessSdk.isInitialized()) { "TikTok SDK has not been initialized." }
      require(externalId.isNotBlank()) { "External user ID must not be empty." }
      TikTokBusinessSdk.identify(externalId, userName, phone, email)
    }

    Function("logout") {
      if (TikTokBusinessSdk.isInitialized()) TikTokBusinessSdk.logout()
    }
  }
}
