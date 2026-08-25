package com.example.musicflow.data.api

import com.google.gson.annotations.SerializedName
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Headers
import retrofit2.http.Query

interface LrcLibApiService {

    @Headers("User-Agent: MusicFlow/1.0 (https://github.com/adi6499/MUSIC-FLOW)")
    @GET("api/get")
    suspend fun getLyrics(
        @Query("track_name") trackName: String,
        @Query("artist_name") artistName: String,
        @Query("album_name") albumName: String? = null,
        @Query("duration") duration: Int? = null
    ): Response<LrcLibResponse>

    @Headers("User-Agent: MusicFlow/1.0 (https://github.com/adi6499/MUSIC-FLOW)")
    @GET("api/search")
    suspend fun searchLyrics(
        @Query("q") query: String
    ): Response<List<LrcLibResponse>>

    @Headers("User-Agent: MusicFlow/1.0 (https://github.com/adi6499/MUSIC-FLOW)")
    @GET("api/search")
    suspend fun searchLyricsByFields(
        @Query("track_name") trackName: String,
        @Query("artist_name") artistName: String
    ): Response<List<LrcLibResponse>>
}

data class LrcLibResponse(
    @SerializedName("id") val id: Int = 0,
    @SerializedName("name") val name: String? = null,
    @SerializedName("trackName") val trackName: String? = null,
    @SerializedName("artistName") val artistName: String? = null,
    @SerializedName("albumName") val albumName: String? = null,
    @SerializedName("duration") val duration: Double? = null,
    @SerializedName("instrumental") val instrumental: Boolean = false,
    @SerializedName("plainLyrics") val plainLyrics: String? = null,
    @SerializedName("syncedLyrics") val syncedLyrics: String? = null
)
