package ru.studyhub.app

import android.app.Application
import ru.studyhub.app.data.SessionStore
import ru.studyhub.app.data.StudyHubApi
import ru.studyhub.app.data.StudyHubDatabase
import ru.studyhub.app.data.StudyHubRepository
import ru.studyhub.app.data.SyncWorker

class StudyHubApplication : Application() {
  lateinit var sessionStore: SessionStore
    private set
  lateinit var database: StudyHubDatabase
    private set
  lateinit var api: StudyHubApi
    private set
  lateinit var repository: StudyHubRepository
    private set

  override fun onCreate() {
    super.onCreate()
    sessionStore = SessionStore(this)
    database = StudyHubDatabase(this)
    api = StudyHubApi()
    repository = StudyHubRepository(
      context = this,
      sessionStore = sessionStore,
      db = database,
      api = api,
    )
    SyncWorker.schedulePeriodic(this)
  }
}
