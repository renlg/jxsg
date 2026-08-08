package com.bytedance.douyinclouddemo.model;

import com.alibaba.fastjson.annotation.JSONField;
import lombok.Data;

@Data
public class OpenAPIBaseResponse {
    @JSONField(name = "err_no")
    private int errorNo;

    @JSONField(name = "err_msg")
    private String errorMsg;

    @JSONField(name = "log_id")
    private String logID;

    @JSONField(name = "data")
    private String data;
}
