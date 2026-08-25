package com.example.musicflow.data.api

import com.example.musicflow.data.model.*
import com.google.gson.annotations.SerializedName
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface MusicApiService {

    @GET("api/search/songs")
    suspend fun searchSongs(
        @Query("query") query: String,
        @Query("limit") limit: Int = 50,
        @Query("page") page: Int = 1
    ): Response<ApiResponse<SearchResultDto<SongDto>>>

    @GET("api/search/albums")
    suspend fun searchAlbums(
        @Query("query") query: String,
        @Query("limit") limit: Int = 20,
        @Query("page") page: Int = 1
    ): Response<ApiResponse<SearchResultDto<AlbumDto>>>

    @GET("api/search/artists")
    suspend fun searchArtists(
        @Query("query") query: String,
        @Query("limit") limit: Int = 20,
        @Query("page") page: Int = 1
    ): Response<ApiResponse<SearchResultDto<ArtistDto>>>

    @GET("api/search/playlists")
    suspend fun searchPlaylists(
        @Query("query") query: String,
        @Query("limit") limit: Int = 20,
        @Query("page") page: Int = 1
    ): Response<ApiResponse<SearchResultDto<PlaylistDto>>>

    @GET("api/search")
    suspend fun searchAll(
        @Query("query") query: String
    ): Response<ApiResponse<FederatedSearchDto>>

    @GET("api/songs/{id}")
    suspend fun getSongDetails(
        @Path("id") id: String
    ): Response<ApiResponse<List<SongDto>>>

    @GET("api/albums")
    suspend fun getAlbumDetails(
        @Query("id") id: String
    ): Response<ApiResponse<AlbumDto>>

    @GET("api/playlists")
    suspend fun getPlaylistDetails(
        @Query("id") id: String,
        @Query("limit") limit: Int = 100
    ): Response<ApiResponse<PlaylistDto>>

    @GET("api/artists")
    suspend fun getArtistDetails(
        @Query("id") id: String,
        @Query("songCount") songCount: Int = 50,
        @Query("albumCount") albumCount: Int = 50
    ): Response<ApiResponse<ArtistDto>>

    @GET("api/artists/{id}")
    suspend fun getArtistDetailsByPath(
        @Path("id") id: String,
        @Query("songCount") songCount: Int = 50,
        @Query("albumCount") albumCount: Int = 50
    ): Response<ApiResponse<ArtistDto>>

    @GET("api/artists/{id}/songs")
    suspend fun getArtistSongs(
        @Path("id") id: String,
        @Query("page") page: Int = 0,
        @Query("sortBy") sortBy: String = "popularity",
        @Query("sortOrder") sortOrder: String = "desc"
    ): Response<ApiResponse<ArtistSongsDto>>

    @GET("api/artists/{id}/albums")
    suspend fun getArtistAlbums(
        @Path("id") id: String,
        @Query("page") page: Int = 0
    ): Response<ApiResponse<ArtistAlbumsDto>>

    @GET("api/lyrics")
    suspend fun getLyrics(
        @Query("id") id: String
    ): Response<ApiResponse<LyricsDto>>

    @GET("api/modules")
    suspend fun getHomeModules(
        @Query("language") language: String = "hindi,english"
    ): Response<ApiResponse<HomeModulesDto>>
}
