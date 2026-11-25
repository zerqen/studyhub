package ru.studyhub.app.data

import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class ApiException(val statusCode: Int, message: String) : IOException(message)

class StudyHubApi {
  companion object {
    const val BASE_URL = "https://studyhub-lime.vercel.app"
  }

  val json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
    explicitNulls = false
  }

  private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

  private val client = OkHttpClient.Builder()
    .connectTimeout(20, TimeUnit.SECONDS)
    .readTimeout(120, TimeUnit.SECONDS)
    .writeTimeout(90, TimeUnit.SECONDS)
    .build()

  suspend fun login(email: String, password: String): LoginResponse =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(LoginRequest(email.trim(), password)).toRequestBody(jsonMediaType)
      val req = Request.Builder()
        .url("$BASE_URL/api/mobile/auth/login")
        .post(body)
        .header("Accept", "application/json")
        .build()
      executeJson(req)
    }

  suspend fun sync(token: String): SyncResponse =
    withContext(Dispatchers.IO) {
      val req = authBuilder(token, "/api/mobile/sync").get().build()
      executeJson(req)
    }

  suspend fun createTask(token: String, payload: CreateTaskRequest): TaskDto =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(payload).toRequestBody(jsonMediaType)
      val req = authBuilder(token, "/api/mobile/tasks").post(body).build()
      executeJson<TaskEnvelope>(req).task
    }

  suspend fun updateTask(token: String, id: String, payload: UpdateTaskRequest): TaskDto =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(payload).toRequestBody(jsonMediaType)
      val req = authBuilder(token, "/api/mobile/tasks/$id").patch(body).build()
      executeJson<TaskEnvelope>(req).task
    }

  suspend fun deleteTask(token: String, id: String) =
    withContext(Dispatchers.IO) {
      val req = authBuilder(token, "/api/mobile/tasks/$id").delete().build()
      executeUnit(req)
    }

  suspend fun createSubtask(token: String, taskId: String, payload: CreateSubtaskRequest): SubtaskDto =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(payload).toRequestBody(jsonMediaType)
      val req = authBuilder(token, "/api/mobile/tasks/$taskId/subtasks").post(body).build()
      executeJson<SubtaskEnvelope>(req).subtask
    }

  suspend fun updateSubtask(token: String, id: String, payload: UpdateSubtaskRequest): SubtaskDto =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(payload).toRequestBody(jsonMediaType)
      val req = authBuilder(token, "/api/mobile/subtasks/$id").patch(body).build()
      executeJson<SubtaskEnvelope>(req).subtask
    }

  suspend fun deleteSubtask(token: String, id: String) =
    withContext(Dispatchers.IO) {
      val req = authBuilder(token, "/api/mobile/subtasks/$id").delete().build()
      executeUnit(req)
    }

  suspend fun reviewQuestion(
    token: String,
    questionId: String,
    grade: Int,
  ): ReviewResponse =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(ReviewRequest(questionId, grade)).toRequestBody(jsonMediaType)
      val req = authBuilder(token, "/api/mobile/review").post(body).build()
      executeJson(req)
    }

  suspend fun createNote(token: String, payload: CreateNoteRequest): NoteDto =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(payload).toRequestBody(jsonMediaType)
      val req = authBuilder(token, "/api/mobile/notes").post(body).build()
      executeJson<NoteEnvelope>(req).note
    }

  suspend fun updateNote(token: String, id: String, payload: UpdateNoteRequest): NoteDto =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(payload).toRequestBody(jsonMediaType)
      val req = authBuilder(token, "/api/mobile/notes/$id").patch(body).build()
      executeJson<NoteEnvelope>(req).note
    }

  suspend fun deleteNote(token: String, id: String) =
    withContext(Dispatchers.IO) {
      val req = authBuilder(token, "/api/mobile/notes/$id").delete().build()
      executeUnit(req)
    }

  suspend fun createLecture(token: String, payload: CreateLectureRequest): LectureDto =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(payload).toRequestBody(jsonMediaType)
      val req = authBuilder(token, "/api/mobile/lectures").post(body).build()
      executeJson<LectureEnvelope>(req).lecture
    }

  suspend fun updateLecture(token: String, id: String, payload: UpdateLectureRequest): LectureDto =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(payload).toRequestBody(jsonMediaType)
      val req = authBuilder(token, "/api/mobile/lectures/$id").patch(body).build()
      executeJson<LectureEnvelope>(req).lecture
    }

  suspend fun deleteLecture(token: String, id: String) =
    withContext(Dispatchers.IO) {
      val req = authBuilder(token, "/api/mobile/lectures/$id").delete().build()
      executeUnit(req)
    }

  suspend fun transcribeLectureAudio(
    token: String,
    lectureId: String,
    attachmentId: String,
  ): String =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(TranscribeRequest(attachmentId)).toRequestBody(jsonMediaType)
      val req = authBuilder(token, "/api/mobile/lectures/$lectureId/transcribe").post(body).build()
      executeJson<TranscribeResponse>(req).transcript
    }

  suspend fun uploadAttachment(
    token: String,
    parentType: String? = null,
    parentId: String? = null,
    fileName: String,
    mimeType: String,
    bytes: ByteArray,
  ): AttachmentDto = withContext(Dispatchers.IO) {
    if (bytes.size <= 4_000_000) {
      val mediaType = runCatching { mimeType.toMediaType() }.getOrDefault("application/octet-stream".toMediaType())
      val formBuilder = MultipartBody.Builder()
        .setType(MultipartBody.FORM)
        .addFormDataPart("file", fileName, bytes.toRequestBody(mediaType))
      if (!parentType.isNullOrBlank() && !parentId.isNullOrBlank()) {
        formBuilder.addFormDataPart("${parentType}Id", parentId)
      }
      val formBody = formBuilder.build()
      val req = authBuilder(token, "/api/mobile/files/upload").post(formBody).build()
      return@withContext executeJson<AttachmentEnvelope>(req).attachment
    }

    // Large file (> 4 MB): direct Vercel Blob upload
    val prepBody = json.encodeToString(
      BlobPrepareRequest(
        parentType = parentType?.takeIf { it.isNotBlank() && !parentId.isNullOrBlank() },
        parentId = parentId?.takeIf { it.isNotBlank() && !parentType.isNullOrBlank() },
        name = fileName,
        size = bytes.size.toLong(),
      ),
    ).toRequestBody(jsonMediaType)
    val prepReq = authBuilder(token, "/api/mobile/files/blob").post(prepBody).build()
    val grant = executeJson<BlobGrantResponse>(prepReq)

    val cleanPath = grant.pathname.trimStart('/')
    if (cleanPath.contains("@") || cleanPath.contains("..")) {
      throw IOException("Некорректный путь загрузки")
    }
    val blobMedia = runCatching { grant.mimeType.toMediaType() }.getOrDefault("application/octet-stream".toMediaType())
    val putReq = Request.Builder()
      .url("https://blob.vercel-storage.com/$cleanPath")
      .put(bytes.toRequestBody(blobMedia))
      .header("Authorization", "Bearer ${grant.clientToken}")
      .header("x-api-version", "7")
      .header("x-content-type", grant.mimeType)
      .header("x-add-random-suffix", "0")
      .build()
    executeUnit(putReq)

    val regBody = json.encodeToString(BlobRegisterRequest(grant.uploadReceipt)).toRequestBody(jsonMediaType)
    val regReq = authBuilder(token, "/api/mobile/files/register").post(regBody).build()
    executeJson<AttachmentEnvelope>(regReq).attachment
  }

  suspend fun downloadAttachment(token: String, attachmentId: String, destFile: File) =
    withContext(Dispatchers.IO) {
      val req = authBuilder(token, "/api/mobile/files/$attachmentId").get().build()
      client.newCall(req).execute().use { res ->
        if (!res.isSuccessful) {
          val text = res.body?.string().orEmpty()
          val msg = runCatching { json.decodeFromString<ApiErrorResponse>(text).error }
            .getOrDefault("Не удалось скачать файл (${res.code})")
          throw ApiException(res.code, msg)
        }
        destFile.parentFile?.mkdirs()
        val tmp = File(destFile.parentFile, "${destFile.name}.part")
        res.body?.byteStream()?.use { input ->
          tmp.outputStream().use { output -> input.copyTo(output) }
        } ?: throw IOException("Пустой ответ от сервера")
        if (destFile.exists()) destFile.delete()
        tmp.renameTo(destFile)
      }
    }

  suspend fun deleteAttachment(token: String, attachmentId: String) =
    withContext(Dispatchers.IO) {
      val req = authBuilder(token, "/api/mobile/files/$attachmentId").delete().build()
      executeUnit(req)
    }

  private fun authBuilder(token: String, path: String): Request.Builder {
    return Request.Builder()
      .url("${BASE_URL}$path")
      .header("Authorization", "Bearer $token")
      .header("Accept", "application/json")
  }

  private inline fun <reified T> executeJson(request: Request): T {
    client.newCall(request).execute().use { res ->
      val text = res.body?.string().orEmpty()
      if (!res.isSuccessful) {
        val msg = runCatching { json.decodeFromString<ApiErrorResponse>(text).error }
          .getOrDefault("Ошибка сервера (${res.code})")
        throw ApiException(res.code, msg)
      }
      return json.decodeFromString(text)
    }
  }

  private fun executeUnit(request: Request) {
    client.newCall(request).execute().use { res ->
      val text = res.body?.string().orEmpty()
      if (!res.isSuccessful) {
        val msg = runCatching { json.decodeFromString<ApiErrorResponse>(text).error }
          .getOrDefault("Ошибка сервера (${res.code})")
        throw ApiException(res.code, msg)
      }
    }
  }
}
