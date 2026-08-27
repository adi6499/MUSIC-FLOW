package com.example.musicflow.data.typesense

object TypesenseConfig {
    var host: String = "10.0.2.2" // Android emulator loopback to host localhost
    var port: Int = 8108
    var protocol: String = "http"
    var searchApiKey: String = "mf_search_dev_key" // Restricted search-only key
    var isEnabled: Boolean = true

    // Legacy accessor pointing strictly to the search-only key
    val apiKey: String
        get() = searchApiKey

    val baseUrl: String
        get() = "$protocol://$host:$port/"
}
