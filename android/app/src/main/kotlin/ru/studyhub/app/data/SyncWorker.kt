package ru.studyhub.app.data

import android.content.Context
import java.util.concurrent.TimeUnit
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import ru.studyhub.app.StudyHubApplication

class SyncWorker(
  appContext: Context,
  params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

  override suspend fun doWork(): Result {
    val app = applicationContext as? StudyHubApplication ?: return Result.success()
    val res = app.repository.syncNow()
    return if (res.isSuccess) Result.success() else Result.retry()
  }

  companion object {
    private const val PERIODIC_NAME = "studyhub_periodic_sync"
    private const val ONESHOT_NAME = "studyhub_pending_sync"

    fun schedulePeriodic(context: Context) {
      val constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()
      val request = PeriodicWorkRequestBuilder<SyncWorker>(30, TimeUnit.MINUTES)
        .setConstraints(constraints)
        .build()
      WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        PERIODIC_NAME,
        ExistingPeriodicWorkPolicy.KEEP,
        request,
      )
    }

    fun enqueueOneShot(context: Context) {
      val constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()
      val request = OneTimeWorkRequestBuilder<SyncWorker>()
        .setConstraints(constraints)
        .build()
      WorkManager.getInstance(context).enqueueUniqueWork(
        ONESHOT_NAME,
        ExistingWorkPolicy.REPLACE,
        request,
      )
    }
  }
}
