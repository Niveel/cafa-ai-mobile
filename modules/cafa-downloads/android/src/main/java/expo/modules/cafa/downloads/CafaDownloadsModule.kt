package expo.modules.cafa.downloads

import android.Manifest
import android.app.DownloadManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Saves generated files the way a normal Android app does (and the way Chrome,
 * ChatGPT and Gemini do): through MediaStore, so the file appears in the system
 * Files app / Gallery with no folder-permission picker, and posts a
 * "Download complete" notification that opens the file when tapped.
 *
 *   images -> Pictures/Cafa AI   (Gallery)
 *   videos -> Movies/Cafa AI     (Gallery)
 *   audio  -> Music/Cafa AI
 *   other  -> Download/Cafa AI   (Files > Downloads)
 */
class CafaDownloadsModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext?.applicationContext) {
      "Android application context is unavailable."
    }

  override fun definition() = ModuleDefinition {
    Name("CafaDownloads")

    AsyncFunction("saveFile") { sourceUri: String, fileName: String, mimeType: String, notify: Boolean ->
      saveFile(sourceUri, fileName, mimeType, notify)
    }

    AsyncFunction("openFile") { contentUri: String, mimeType: String ->
      openFile(contentUri, mimeType)
    }

    AsyncFunction("fileExists") { contentUri: String ->
      try {
        context.contentResolver.openFileDescriptor(Uri.parse(contentUri), "r")?.use { true } ?: false
      } catch (_: Exception) {
        false
      }
    }

    // Puts a file on the system clipboard (as a content URI), so it can be pasted
    // into apps that accept files/images, instead of copying text about the file.
    AsyncFunction("copyFileToClipboard") { contentUri: String, label: String ->
      val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      manager.setPrimaryClip(ClipData.newUri(context.contentResolver, label, Uri.parse(contentUri)))
      true
    }

    Function("openDownloadsFolder") {
      val intent = Intent(DownloadManager.ACTION_VIEW_DOWNLOADS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
        true
      } catch (_: Exception) {
        false
      }
    }
  }

  private fun saveFile(sourceUri: String, fileName: String, mimeType: String, notify: Boolean): Map<String, Any?> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      // Android 7-9 would need the legacy storage permission and a FileProvider.
      // The JS side falls back to the system share sheet for these.
      throw CodedException("ERR_UNSUPPORTED", "Saving to Downloads needs Android 10 or newer.", null)
    }

    val resolver = context.contentResolver
    val mime = mimeType.ifBlank { "application/octet-stream" }
    val (collection, relativeDir) = when {
      mime.startsWith("image/") -> MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY) to "Pictures/Cafa AI"
      mime.startsWith("video/") -> MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY) to "Movies/Cafa AI"
      mime.startsWith("audio/") -> MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY) to "Music/Cafa AI"
      else -> MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY) to "Download/Cafa AI"
    }

    val values = ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
      put(MediaStore.MediaColumns.MIME_TYPE, mime)
      put(MediaStore.MediaColumns.RELATIVE_PATH, relativeDir)
      put(MediaStore.MediaColumns.IS_PENDING, 1)
    }
    val target = resolver.insert(collection, values)
      ?: throw CodedException("ERR_SAVE_FAILED", "Could not create the file in shared storage.", null)

    try {
      val input = resolver.openInputStream(Uri.parse(sourceUri))
        ?: throw CodedException("ERR_SOURCE_MISSING", "The downloaded file could not be read.", null)
      input.use { source ->
        resolver.openOutputStream(target)?.use { out -> source.copyTo(out) }
          ?: throw CodedException("ERR_SAVE_FAILED", "Could not write the file.", null)
      }
      val done = ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }
      resolver.update(target, done, null, null)
    } catch (error: Exception) {
      // Do not leave a half-written entry behind.
      runCatching { resolver.delete(target, null, null) }
      throw error
    }

    // MediaStore may have renamed the file ("name (1).pdf") to avoid a clash.
    val savedName = resolver.query(target, arrayOf(MediaStore.MediaColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) cursor.getString(0) else null
    } ?: fileName

    if (notify) postDownloadNotification(target, savedName, mime)

    return mapOf(
      "contentUri" to target.toString(),
      "fileName" to savedName,
      "displayPath" to "$relativeDir/$savedName",
      "folder" to relativeDir,
    )
  }

  private fun viewIntent(uri: Uri, mime: String): Intent =
    Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(uri, mime.ifBlank { "*/*" })
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    }

  private fun openFile(contentUri: String, mimeType: String): Boolean {
    return try {
      context.startActivity(viewIntent(Uri.parse(contentUri), mimeType))
      true
    } catch (_: Exception) {
      false
    }
  }

  private fun postDownloadNotification(uri: Uri, fileName: String, mime: String) {
    val ctx = context
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) return
    if (!NotificationManagerCompat.from(ctx).areNotificationsEnabled()) return

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (manager.getNotificationChannel(CHANNEL_ID) == null) {
        manager.createNotificationChannel(
          NotificationChannel(CHANNEL_ID, "Downloads", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Shows when a file from Cafa AI has been saved to your phone."
          },
        )
      }
    }

    val pendingIntent = PendingIntent.getActivity(
      ctx,
      uri.hashCode(),
      viewIntent(uri, mime),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val icon = ctx.resources.getIdentifier("notification_icon", "drawable", ctx.packageName)
      .takeIf { it != 0 } ?: android.R.drawable.stat_sys_download_done

    val notification = NotificationCompat.Builder(ctx, CHANNEL_ID)
      .setSmallIcon(icon)
      .setContentTitle("Download complete")
      .setContentText(fileName)
      .setContentIntent(pendingIntent)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()

    try {
      NotificationManagerCompat.from(ctx).notify(uri.hashCode(), notification)
    } catch (_: SecurityException) {
      // Notification permission was revoked between the check and the call.
    }
  }

  companion object {
    private const val CHANNEL_ID = "cafa_downloads"
  }
}
