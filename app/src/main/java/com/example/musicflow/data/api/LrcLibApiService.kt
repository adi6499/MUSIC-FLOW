package com.example.musicflow.data.api

import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

interface LrcLibApiService {
    @GET("api/get")
    suspend fun getLyrics(
        @Query("track_name") trackName: String,
        @Query("artist_name") artistName: String,
        @Query("album_name") albumName: String? = null,
        @Query("duration") duration: Int? = null
    ): Response<LrcLibResponse>
}

data class LrcLibResponse(
    val id: Int,
    val name: String,
    val trackName: String?,
    val artistName: String,
    val albumName: String?,
    val duration: Int?,
    val instrumental: Boolean,
    val plainLyrics: String?,
    val syncedLyrics: String?
)
