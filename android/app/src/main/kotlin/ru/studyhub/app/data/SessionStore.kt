package ru.studyhub.app.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.sessionDataStore by preferencesDataStore(name = "studyhub_session")

class SessionStore(private val context: Context) {
  companion object {
    private val KEY_SERVER_URL = stringPreferencesKey("server_url")
    private val KEY_TOKEN = stringPreferencesKey("auth_token")
    private val KEY_USER_ID = stringPreferencesKey("user_id")
    private val KEY_USER_NAME = stringPreferencesKey("user_name")
    private val KEY_USER_EMAIL = stringPreferencesKey("user_email")
    private val KEY_LAST_SYNC = longPreferencesKey("last_sync_at")
    private val KEY_DONE_WEEK = intPreferencesKey("done_this_week")
    private val KEY_DUE_REVIEW = intPreferencesKey("due_review_count")
    private val KEY_THEME_MODE = stringPreferencesKey("theme_mode")
    private val KEY_SHOW_LESSONS = booleanPreferencesKey("show_lessons")
  }

  val sessionFlow: Flow<AuthSession> = context.sessionDataStore.data.map { p ->
    AuthSession(
      serverUrl = p[KEY_SERVER_URL].orEmpty(),
      token = p[KEY_TOKEN].orEmpty(),
      userId = p[KEY_USER_ID].orEmpty(),
      userName = p[KEY_USER_NAME].orEmpty(),
      userEmail = p[KEY_USER_EMAIL].orEmpty(),
      lastSyncAt = p[KEY_LAST_SYNC] ?: 0L,
      doneThisWeek = p[KEY_DONE_WEEK] ?: 0,
      dueReviewCount = p[KEY_DUE_REVIEW] ?: 0,
      themeMode = p[KEY_THEME_MODE] ?: "system",
      showLessons = p[KEY_SHOW_LESSONS] ?: false,
    )
  }

  suspend fun current(): AuthSession = sessionFlow.first()

  suspend fun saveLogin(serverUrl: String, token: String, user: MobileUserDto) {
    val cleanUrl = serverUrl.trim().trimEnd('/')
    context.sessionDataStore.edit { p ->
      p[KEY_SERVER_URL] = cleanUrl
      p[KEY_TOKEN] = token
      p[KEY_USER_ID] = user.id
      p[KEY_USER_NAME] = user.name
      p[KEY_USER_EMAIL] = user.email
    }
  }

  suspend fun updateSyncMeta(user: MobileUserDto, stats: SyncStatsDto, syncedAt: Long) {
    context.sessionDataStore.edit { p ->
      p[KEY_USER_NAME] = user.name
      p[KEY_USER_EMAIL] = user.email
      p[KEY_LAST_SYNC] = syncedAt
      p[KEY_DONE_WEEK] = stats.doneThisWeek
      p[KEY_DUE_REVIEW] = stats.dueReviewCount
    }
  }

  suspend fun setThemeMode(mode: String) {
    context.sessionDataStore.edit { p ->
      p[KEY_THEME_MODE] = mode
    }
  }

  suspend fun setShowLessons(show: Boolean) {
    context.sessionDataStore.edit { p ->
      p[KEY_SHOW_LESSONS] = show
    }
  }

  suspend fun clearAuth() {
    context.sessionDataStore.edit { p ->
      val savedUrl = p[KEY_SERVER_URL].orEmpty()
      val savedTheme = p[KEY_THEME_MODE] ?: "system"
      val savedShowLessons = p[KEY_SHOW_LESSONS] ?: false
      p.clear()
      if (savedUrl.isNotBlank()) p[KEY_SERVER_URL] = savedUrl
      p[KEY_THEME_MODE] = savedTheme
      p[KEY_SHOW_LESSONS] = savedShowLessons
    }
  }
}
