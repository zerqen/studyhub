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
    private val KEY_TOKEN = stringPreferencesKey("auth_token")
    private val KEY_USER_ID = stringPreferencesKey("user_id")
    private val KEY_USER_NAME = stringPreferencesKey("user_name")
    private val KEY_USER_EMAIL = stringPreferencesKey("user_email")
    private val KEY_LAST_SYNC = longPreferencesKey("last_sync_at")
    private val KEY_DONE_WEEK = intPreferencesKey("done_this_week")
    private val KEY_DUE_REVIEW = intPreferencesKey("due_review_count")
    private val KEY_THEME_MODE = stringPreferencesKey("theme_mode")
    private val KEY_SHOW_LESSONS = booleanPreferencesKey("show_lessons")
    private val KEY_NOTIF_MORNING_ENABLED = booleanPreferencesKey("notif_morning_enabled")
    private val KEY_NOTIF_MORNING_HOUR = intPreferencesKey("notif_morning_hour")
    private val KEY_NOTIF_MORNING_MIN = intPreferencesKey("notif_morning_min")
    private val KEY_NOTIF_EVENING_ENABLED = booleanPreferencesKey("notif_evening_enabled")
    private val KEY_NOTIF_EVENING_HOUR = intPreferencesKey("notif_evening_hour")
    private val KEY_NOTIF_EVENING_MIN = intPreferencesKey("notif_evening_min")
  }

  val sessionFlow: Flow<AuthSession> = context.sessionDataStore.data.map { p ->
    AuthSession(
      token = p[KEY_TOKEN].orEmpty(),
      userId = p[KEY_USER_ID].orEmpty(),
      userName = p[KEY_USER_NAME].orEmpty(),
      userEmail = p[KEY_USER_EMAIL].orEmpty(),
      lastSyncAt = p[KEY_LAST_SYNC] ?: 0L,
      doneThisWeek = p[KEY_DONE_WEEK] ?: 0,
      dueReviewCount = p[KEY_DUE_REVIEW] ?: 0,
      themeMode = p[KEY_THEME_MODE] ?: "system",
      showLessons = p[KEY_SHOW_LESSONS] ?: false,
      notifMorningEnabled = p[KEY_NOTIF_MORNING_ENABLED] ?: true,
      notifMorningHour = p[KEY_NOTIF_MORNING_HOUR] ?: 8,
      notifMorningMinute = p[KEY_NOTIF_MORNING_MIN] ?: 0,
      notifEveningEnabled = p[KEY_NOTIF_EVENING_ENABLED] ?: true,
      notifEveningHour = p[KEY_NOTIF_EVENING_HOUR] ?: 20,
      notifEveningMinute = p[KEY_NOTIF_EVENING_MIN] ?: 0,
    )
  }

  suspend fun current(): AuthSession = sessionFlow.first()

  suspend fun saveLogin(token: String, user: MobileUserDto) {
    context.sessionDataStore.edit { p ->
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

  suspend fun saveNotificationPrefs(
    morningEnabled: Boolean,
    morningHour: Int,
    morningMinute: Int,
    eveningEnabled: Boolean,
    eveningHour: Int,
    eveningMinute: Int,
  ) {
    context.sessionDataStore.edit { p ->
      p[KEY_NOTIF_MORNING_ENABLED] = morningEnabled
      p[KEY_NOTIF_MORNING_HOUR] = morningHour
      p[KEY_NOTIF_MORNING_MIN] = morningMinute
      p[KEY_NOTIF_EVENING_ENABLED] = eveningEnabled
      p[KEY_NOTIF_EVENING_HOUR] = eveningHour
      p[KEY_NOTIF_EVENING_MIN] = eveningMinute
    }
  }

  suspend fun clearAuth() {
    context.sessionDataStore.edit { p ->
      val savedTheme = p[KEY_THEME_MODE] ?: "system"
      val savedShowLessons = p[KEY_SHOW_LESSONS] ?: false
      val mEn = p[KEY_NOTIF_MORNING_ENABLED] ?: true
      val mH = p[KEY_NOTIF_MORNING_HOUR] ?: 8
      val mM = p[KEY_NOTIF_MORNING_MIN] ?: 0
      val eEn = p[KEY_NOTIF_EVENING_ENABLED] ?: true
      val eH = p[KEY_NOTIF_EVENING_HOUR] ?: 20
      val eM = p[KEY_NOTIF_EVENING_MIN] ?: 0
      p.clear()
      p[KEY_THEME_MODE] = savedTheme
      p[KEY_SHOW_LESSONS] = savedShowLessons
      p[KEY_NOTIF_MORNING_ENABLED] = mEn
      p[KEY_NOTIF_MORNING_HOUR] = mH
      p[KEY_NOTIF_MORNING_MIN] = mM
      p[KEY_NOTIF_EVENING_ENABLED] = eEn
      p[KEY_NOTIF_EVENING_HOUR] = eH
      p[KEY_NOTIF_EVENING_MIN] = eM
    }
  }
}
