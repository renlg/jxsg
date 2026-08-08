package com.bytedance.douyinclouddemo.utils;

import com.alibaba.fastjson.JSON;
import lombok.extern.slf4j.Slf4j;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
public class OkHttpUtils {

    private static OkHttpClient buildHttpClient() {
        return new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(10, TimeUnit.SECONDS)
                .writeTimeout(10, TimeUnit.SECONDS)
                .build();
    }

    public static String post(String url, Map<String, String> headerMap, String bodyJSON) throws IllegalStateException {
        // 构造请求request
        Request.Builder builder = new Request.Builder();
        builder.url(url);
        headerMap.forEach(builder::addHeader);

        RequestBody body = RequestBody.create(bodyJSON, null);
        Request request = builder.post(body).build();
        try {
            Response response = buildHttpClient().newCall(request).execute();
            if (response.code() != 200) {
                log.error("HTTP请求失败, 响应:{}", JSON.toJSONString(response));
                throw new IllegalStateException(String.format("HTTP请求失败, 错误码: %d, 错误信息: %s", response.code(), response.message()));
            }

            return response.body().string();
        } catch (Exception e) {
            log.error("HTTP请求失败, url {}, header {}, body {}, e {}", url, headerMap, bodyJSON, e.getMessage(), e);
            throw new IllegalStateException("HTTP请求异常");
        }
    }
}
