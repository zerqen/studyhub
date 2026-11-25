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

  suspend fun login(serverUrl: String, email: String, password: String): LoginResponse =
    withContext(Dispatchers.IO) {
      val cleanBase = serverUrl.trim().trimEnd('/')
      val body = json.encodeToString(LoginRequest(email.trim(), password)).toRequestBody(jsonMediaType)
      val req = Request.Builder()
        .url("$cleanBase/api/mobile/auth/login")
        .post(body)
        .header("Accept", "application/json")
        .build()
      executeJson(req)
    }

  suspend fun sync(serverUrl: String, token: String): SyncResponse =
    withContext(Dispatchers.IO) {
      val req = authBuilder(serverUrl, token, "/api/mobile/sync").get().build()
      executeJson(req)
    }

  suspend fun createTask(serverUrl: String, token: String, payload: CreateTaskRequest): TaskDto =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(payload).toRequestBody(jsonMediaType)
      val req = authBuilder(serverUrl, token, "/api/mobile/tasks").post(body).build()
      executeJson<TaskEnvelope>(req).task
    }

  suspend fun updateTask(serverUrl: String, token: String, id: String, payload: UpdateTaskRequest): TaskDto =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(payload).toRequestBody(jsonMediaType)
      val req = authBuilder(serverUrl, token, "/api/mobile/tasks/$id").patch(body).build()
      executeJson<TaskEnvelope>(req).task
    }

  suspend fun deleteTask(serverUrl: String, token: String, id: String) =
    withContext(Dispatchers.IO) {
      val req = authBuilder(serverUrl, token, "/api/mobile/tasks/$id").delete().build()
      executeUnit(req)
    }

  suspend fun createSubtask(serverUrl: String, token: String, taskId: String, payload: CreateSubtaskRequest): SubtaskDto =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(payload).toRequestBody(jsonMediaType)
      val req = authBuilder(serverUrl, token, "/api/mobile/tasks/$taskId/subtasks").post(body).build()
      executeJson<SubtaskEnvelope>(req).subtask
    }

  suspend fun updateSubtask(serverUrl: String, token: String, id: String, payload: UpdateSubtaskRequest): SubtaskDto =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(payload).toRequestBody(jsonMediaType)
      val req = authBuilder(serverUrl, token, "/api/mobile/subtasks/$id").patch(body).build()
      executeJson<SubtaskEnvelope>(req).subtask
    }

  suspend fun deleteSubtask(serverUrl: String, token: String, id: String) =
    withContext(Dispatchers.IO) {
      val req = authBuilder(serverUrl, token, "/api/mobile/subtasks/$id").delete().build()
      executeUnit(req)
    }

  suspend fun reviewQuestion(
    serverUrl: String,
    token: String,
    questionId: String,
    grade: Int,
  ): ReviewResponse =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(ReviewRequest(questionId, grade)).toRequestBody(jsonMediaType)
      val req = authBuilder(serverUrl, token, "/api/mobile/review").post(body).build()
      executeJson(req)
    }

  suspend fun createNote(serverUrl: String, token: String, payload: CreateNoteRequest): NoteDto =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(payload).toRequestBody(jsonMediaType)
      val req = authBuilder(serverUrl, token, "/api/mobile/notes").post(body).build()
      executeJson<NoteEnvelope>(req).note
    }

  suspend fun updateNote(serverUrl: String, token: String, id: String, payload: UpdateNoteRequest): NoteDto =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(payload).toRequestBody(jsonMediaType)
      val req = authBuilder(serverUrl, token, "/api/mobile/notes/$id").patch(body).build()
      executeJson<NoteEnvelope>(req).note
    }

  suspend fun deleteNote(serverUrl: String, token: String, id: String) =
    withContext(Dispatchers.IO) {
      val req = authBuilder(serverUrl, token, "/api/mobile/notes/$id").delete().build()
      executeUnit(req)
    }

  suspend fun createLecture(serverUrl: String, token: String, payload: CreateLectureRequest): LectureDto =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(payload).toRequestBody(jsonMediaType)
      val req = authBuilder(serverUrl, token, "/api/mobile/lectures").post(body).build()
      executeJson<LectureEnvelope>(req).lecture
    }

  suspend fun updateLecture(serverUrl: String, token: String, id: String, payload: UpdateLectureRequest): LectureDto =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(payload).toRequestBody(jsonMediaType)
      val req = authBuilder(serverUrl, token, "/api/mobile/lectures/$id").patch(body).build()
      executeJson<LectureEnvelope>(req).lecture
    }

  suspend fun deleteLecture(serverUrl: String, token: String, id: String) =
    withContext(Dispatchers.IO) {
      val req = authBuilder(serverUrl, token, "/api/mobile/lectures/$id").delete().build()
      executeUnit(req)
    }

  suspend fun transcribeLectureAudio(
    serverUrl: String,
    token: String,
    lectureId: String,
    attachmentId: String,
  ): String =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(TranscribeRequest(attachmentId)).toRequestBody(jsonMediaType)
      val req = authBuilder(serverUrl, token, "/api/mobile/lectures/$lectureId/transcribe").post(body).build()
      executeJson<TranscribeResponse>(req).transcript
    }

  suspend fun uploadAttachment(
    serverUrl: String,
    token: String,
    parentType: String,
    parentId: String,
    fileName: String,
    mimeType: String,
    bytes: ByteArray,
  ): AttachmentDto = withContext(Dispatchers.IO) {
    if (bytes.size <= 4_000_000) {
      val mediaType = runCatching { mimeType.toMediaType() }.getOrDefault("application/octet-stream".toMediaType())
      val formBody = MultipartBody.Builder()
        .setType(MultipartBody.FORM)
        .addFormDataPart("${parentType}Id", parentId)
        .addFormDataPart("file", fileName, bytes.toRequestBody(mediaType))
        .build()
      val req = authBuilder(serverUrl, token, "/api/mobile/files/upload").post(formBody).build()
      return@withContext executeJson<AttachmentEnvelope>(req).attachment
    }

    // Large file (> 4 MB): direct Vercel Blob upload
    val prepBody = json.encodeToString(
      BlobPrepareRequest(
        parentType = parentType,
        parentId = parentId,
        name = fileName,
        size = bytes.size.toLong(),
      ),
    ).toRequestBody(jsonMediaType)
    val prepReq = authBuilder(serverUrl, token, "/api/mobile/files/blob").post(prepBody).build()
    val grant = executeJson<BlobGrantResponse>(prepReq)

    val blobMedia = runCatching { grant.mimeType.toMediaType() }.getOrDefault("application/octet-stream".toMediaType())
    val putReq = Request.Builder()
      .url("https://blob.vercel-storage.com/${grant.pathname}")
      .put(bytes.toRequestBody(blobMedia))
      .header("Authorization", "Bearer ${grant.clientToken}")
      .header("x-api-version", "7")
      .header("x-content-type", grant.mimeType)
      .header("x-add-random-suffix", "0")
      .build()
    executeUnit(putReq)

    val regBody = json.encodeToString(BlobRegisterRequest(grant.uploadReceipt)).toRequestBody(jsonMediaType)
    val regReq = authBuilder(serverUrl, token, "/api/mobile/files/register").post(regBody).build()
    executeJson<AttachmentEnvelope>(regReq).attachment
  }

  suspend fun downloadAttachment(serverUrl: String, token: String, attachmentId: String, destFile: File) =
    withContext(Dispatchers.IO) {
      val req = authBuilder(serverUrl, token, "/api/mobile/files/$attachmentId").get().build()
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

  suspend fun deleteAttachment(serverUrl: String, token: String, attachmentId: String) =
    withContext(Dispatchers.IO) {
      val req = authBuilder(serverUrl, token, "/api/mobile/files/$attachmentId").delete().build()
      executeUnit(req)
    }

  private fun authBuilder(serverUrl: String, token: String, path: String): Request.Builder {
    val cleanBase = serverUrl.trim().trimEnd('/')
    return Request.Builder()
      .url("$cleanBase$path")
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
