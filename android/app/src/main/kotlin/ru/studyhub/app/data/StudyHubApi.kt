package ru.studyhub.app.data

import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
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
    .connectTimeout(15, TimeUnit.SECONDS)
    .readTimeout(25, TimeUnit.SECONDS)
    .writeTimeout(25, TimeUnit.SECONDS)
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
