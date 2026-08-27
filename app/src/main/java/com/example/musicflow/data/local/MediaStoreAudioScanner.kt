package com.example.musicflow.data.local

import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.provider.MediaStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

object MediaStoreAudioScanner {

    suspend fun scanDeviceAudio(context: Context, dao: MusicDao): List<LocalTrackEntity> = withContext(Dispatchers.IO) {
        val tracks = mutableListOf<LocalTrackEntity>()

        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.DATA,
            MediaStore.Audio.Media.YEAR,
            MediaStore.Audio.Media.TRACK,
            MediaStore.Audio.Media.ALBUM_ID,
            MediaStore.Audio.Media.DATE_MODIFIED
        )

        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0 AND ${MediaStore.Audio.Media.DURATION} >= 5000"
        val sortOrder = "${MediaStore.Audio.Media.DATE_MODIFIED} DESC"

        try {
            val cursor = context.contentResolver.query(
                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                projection,
                selection,
                null,
                sortOrder
            )

            cursor?.use {
                val idCol = it.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
                val titleCol = it.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
                val artistCol = it.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
                val albumCol = it.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
                val durationCol = it.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
                val dataCol = it.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA)
                val yearCol = it.getColumnIndexOrThrow(MediaStore.Audio.Media.YEAR)
                val trackCol = it.getColumnIndexOrThrow(MediaStore.Audio.Media.TRACK)
                val albumIdCol = it.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)
                val modifiedCol = it.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_MODIFIED)

                val albumArtBaseUri = Uri.parse("content://media/external/audio/albumart")

                while (it.moveToNext()) {
                    val mediaId = it.getLong(idCol)
                    val rawTitle = it.getString(titleCol) ?: ""
                    val rawArtist = it.getString(artistCol) ?: "Unknown Artist"
                    val rawAlbum = it.getString(albumCol) ?: "Local Album"
                    val durationMs = it.getInt(durationCol)
                    val path = it.getString(dataCol) ?: ""
                    val year = it.getInt(yearCol).let { y -> if (y > 0) y.toString() else "" }
                    val trackNum = it.getInt(trackCol)
                    val albumId = it.getLong(albumIdCol)
                    val lastModified = it.getLong(modifiedCol)

                    val file = File(path)
                    if (!file.exists() || file.length() < 10000) continue

                    val folderName = file.parentFile?.name ?: "Device Audio"
                    val artUri = if (albumId > 0) {
                        ContentUris.withAppendedId(albumArtBaseUri, albumId).toString()
                    } else ""

                    val title = if (rawTitle.isNotBlank()) rawTitle else file.nameWithoutExtension
                    val artist = if (rawArtist.isNotBlank() && rawArtist != "<unknown>") rawArtist else "Unknown Artist"
                    val album = if (rawAlbum.isNotBlank() && rawAlbum != "<unknown>") rawAlbum else folderName

                    tracks.add(
                        LocalTrackEntity(
                            id = "local_media_$mediaId",
                            title = title,
                            artist = artist,
                            album = album,
                            albumArtist = artist,
                            duration = durationMs / 1000,
                            path = path,
                            folderName = folderName,
                            year = year,
                            genre = "",
                            trackNumber = trackNum,
                            artworkUri = artUri,
                            lastModified = lastModified
                        )
                    )
                }
            }

            if (tracks.isNotEmpty()) {
                dao.insertLocalTracks(tracks)
            }
        } catch (e: Exception) {
            android.util.Log.e("MediaStoreScanner", "Scanning failed: ${e.message}", e)
        }

        tracks
    }
}
