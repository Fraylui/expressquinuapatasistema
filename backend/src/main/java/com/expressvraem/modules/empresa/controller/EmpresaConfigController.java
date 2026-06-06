package com.expressvraem.modules.empresa.controller;

import com.expressvraem.modules.empresa.entity.EmpresaConfig;
import com.expressvraem.modules.empresa.service.EmpresaConfigService;
import com.expressvraem.shared.exceptions.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/empresa-config")
@RequiredArgsConstructor
public class EmpresaConfigController {

    private final EmpresaConfigService service;

    @GetMapping
    public ResponseEntity<ApiResponse<EmpresaConfig>> get() {
        return ResponseEntity.ok(ApiResponse.ok(service.get()));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<EmpresaConfig>> save(@RequestBody EmpresaConfig cfg) {
        return ResponseEntity.ok(ApiResponse.ok(service.save(cfg)));
    }
}
