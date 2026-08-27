package com.example.musicflow.data.typesense

import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

interface TypesenseApiService {

    @GET("health")
    suspend fun healthCheck(
        @Header("X-TYPESENSE-API-KEY") apiKey: String
    ): Response<ResponseBody>

    @POST("multi_search")
    suspend fun multiSearch(
        @Header("X-TYPESENSE-API-KEY") apiKey: String,
        @Body request: MultiSearchRequest
    ): Response<MultiSearchResponse>
}
