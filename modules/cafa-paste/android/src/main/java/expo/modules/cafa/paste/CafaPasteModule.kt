package expo.modules.cafa.paste

import android.content.ClipData
import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.view.View
import android.webkit.MimeTypeMap
import androidx.core.util.Predicate
import androidx.core.view.OnReceiveContentListener
import androidx.core.view.ViewCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Lets the chat text box accept pasted images and files.
 *
 * React Native's Android text box turns every paste into "paste as plain text",
 * which throws away anything that is not text. Registering a content-receiving
 * listener on the underlying EditText (the same mechanism WhatsApp and ChatGPT
 * use) hands pasted images and files to the app. Plain text is passed straight
 * back, so normal pasting of text is unchanged.
 */
class CafaPasteModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext?.applicationContext) {
      "Android application context is unavailable."
    }

  private val receiveContentListener = OnReceiveContentListener { _, payload ->
    val split = payload.partition(Predicate<ClipData.Item> { item -> item.uri != null })
    val withUri = split.first
    val remaining = split.second
    if (withUri != null) {
      val clip = withUri.clip
      val uris = (0 until clip.itemCount).mapNotNull { index -> clip.getItemAt(index).uri }
      // Copying can take a moment for large files, so keep it off the UI thread.
      Thread { importAndEmit(uris) }.start()
    }
    // Whatever was not a file/image (normal text) goes back to the text box.
    remaining
  }

  override fun definition() = ModuleDefinition {
    Name("CafaPaste")

    Events("onPaste")

    AsyncFunction("enablePaste") { viewTag: Int ->
      val view = appContext.findView<View>(viewTag)
        ?: throw CodedException("ERR_VIEW_NOT_FOUND", "The text box was not found.", null)
      ViewCompat.setOnReceiveContentListener(view, ACCEPTED_TYPES, receiveContentListener)
      true
    }.runOnQueue(Queues.MAIN)
  }

  private fun importAndEmit(uris: List<Uri>) {
    val items = uris.mapNotNull { uri -> runCatching { importUri(uri) }.getOrNull() }
    if (items.isNotEmpty()) sendEvent("onPaste", mapOf("items" to items))
  }

  // The pasted address is only readable for a short time, so the content is copied
  // into the app's own cache right away.
  private fun importUri(uri: Uri): Map<String, Any?> {
    val resolver = context.contentResolver
    val mimeMap = MimeTypeMap.getSingleton()
    val mimeType = resolver.getType(uri)
      ?: mimeMap.getMimeTypeFromExtension(MimeTypeMap.getFileExtensionFromUrl(uri.toString()))
      ?: "application/octet-stream"

    var name = resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) cursor.getString(0) else null
    } ?: uri.lastPathSegment ?: "pasted"
    if (!name.contains('.')) {
      mimeMap.getExtensionFromMimeType(mimeType)?.let { extension -> name = "$name.$extension" }
    }

    val directory = File(context.cacheDir, "pasted").apply { mkdirs() }
    val safeName = name.replace(Regex("[^A-Za-z0-9._-]"), "_")
    val target = File(directory, "${System.currentTimeMillis()}-$safeName")
    val input = resolver.openInputStream(uri)
      ?: throw CodedException("ERR_SOURCE_MISSING", "The pasted content could not be read.", null)
    input.use { source -> target.outputStream().use { out -> source.copyTo(out) } }

    return mapOf(
      "uri" to "file://${target.absolutePath}",
      "fileName" to name,
      "mimeType" to mimeType,
    )
  }

  companion object {
    private val ACCEPTED_TYPES = arrayOf(
      "image/*",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/octet-stream",
      "text/*",
    )
  }
}
