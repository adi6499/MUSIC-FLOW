package com.example.musicflow.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.example.musicflow.data.local.DownloadedSongEntity
import com.example.musicflow.data.local.MusicDatabase
import java.io.File
import java.net.URL

class DownloadWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val songId = inputData.getString("songId") ?: return Result.failure()
        val songName = inputData.getString("songName") ?: ""
        val artists = inputData.getString("artists") ?: ""
        val album = inputData.getString("album") ?: ""
        val imageUrl = inputData.getString("imageUrl") ?: ""
        val downloadUrl = inputData.getString("downloadUrl") ?: return Result.failure()
        val duration = inputData.getInt("duration", 0)

        return try {
            val downloadsDir = File(applicationContext.filesDir, "downloads")
            if (!downloadsDir.exists()) downloadsDir.mkdirs()
            
            val destinationFile = File(downloadsDir, "$songId.mp3")
            
            URL(downloadUrl).openStream().use { input ->
                destinationFile.outputStream().use { output ->
                    input.copyTo(output)
                }
            }

            val database = MusicDatabase.getDatabase(applicationContext)
            database.musicDao().insertDownload(
                DownloadedSongEntity(
                    id = songId,
                    name = songName,
                    artists = artists,
                    album = album,
                    duration = duration,
                    image = imageUrl,
                    localPath = destinationFile.absolutePath
                )
            )

            Result.success()
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure()
        }
    }

    companion object {
        const val WORK_NAME_PREFIX = "download_"
        
        fun createInputData(
            songId: String,
            songName: String,
            artists: String,
            album: String,
            imageUrl: String,
            downloadUrl: String,
            duration: Int
        ) = workDataOf(
            "songId" to songId,
            "songName" to songName,
            "artists" to artists,
            "album" to album,
            "imageUrl" to imageUrl,
            "downloadUrl" to downloadUrl,
            "duration" to duration
        )
    }
}
