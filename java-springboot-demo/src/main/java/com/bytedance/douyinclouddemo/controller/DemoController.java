package com.bytedance.douyinclouddemo.controller;

import com.alibaba.fastjson2.JSONObject;
import com.bytedance.douyinclouddemo.utils.OkHttpUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@Slf4j
public class DemoController {
    /**
     * 抖音云调用域名,参考:<a href="https://developer.open-douyin.com/docs/resource/zh-CN/developer/tools/cloud/develop-guide/cloud-call">...</a>
     */
    public static final String DOUYINCLOUD_CLOUD_CALL_HOST = "http://developer-toutiao-com.openapi.dyc.ivolces.com";

    /**
     * 敏感词检测
     */
    public static final String ANTIDIRT_URL = "/api/v2/tags/text/antidirt";

    /**
     * 免登录获取OpenID示例
     * 小程序通过callContainer调用时，抖音云网关会自动将请求的OpenID注入在请求头的X-TT-OPENID中
     */
    @GetMapping("/get_open_id")
    public String getOpenID(@RequestHeader("X-TT-OPENID") String openID) {
        log.info("/get_open_id, openID: {}", openID);
        return new JSONObject()
                .fluentPut("code", 0)
                .fluentPut("message", "")
                .fluentPut("data", openID)
                .toJSONString();
    }

    @PostMapping("/antidirt")
    public String antidirt(@RequestBody String requestBody) {
        String url = DOUYINCLOUD_CLOUD_CALL_HOST + ANTIDIRT_URL;
        // 请求头,无需填写access-token
        Map<String, String> headers = new HashMap<String, String>();
        headers.put("Content-Type", "application/json");

        // 通过OkHTTP库发起HTTP调用
        try {
            return OkHttpUtils.post(url, headers, requestBody);
        } catch (IllegalStateException e) {
            log.error("/antidirt exception, ex: {}", e.getMessage(), e);
        }
        return "failure, catch exception";
    }

    // 云数据库服务端示例,目前仅支持node.js语言
    @PostMapping("/insert_record")
    public String insertRecord(@RequestBody String requestBody) {
        return new JSONObject()
                .fluentPut("code", 1)
                .fluentPut("message", "云数据库仅支持nodejs语言")
                .toJSONString();
    }

    @GetMapping("/select_record")
    public String getRecord() {
        return new JSONObject()
                .fluentPut("code", 1)
                .fluentPut("message", "云数据库仅支持nodejs语言")
                .toJSONString();
    }

    @PostMapping("/update_record")
    public String updateRecord(@RequestBody String requestBody) {
        return new JSONObject()
                .fluentPut("code", 1)
                .fluentPut("message", "云数据库仅支持nodejs语言")
                .toJSONString();
    }
}
