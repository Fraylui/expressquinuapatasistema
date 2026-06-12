package com.expressvraem.modules.empresa.controller;

import com.expressvraem.modules.empresa.entity.EmpresaConfig;
import com.expressvraem.modules.empresa.service.EmpresaConfigService;
import com.expressvraem.shared.exceptions.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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

    // GERENTE administra Configuración → Empresa (nombre, logo, cuota de combi)
    @PutMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE')")
    public ResponseEntity<ApiResponse<EmpresaConfig>> save(@Valid @RequestBody EmpresaConfig cfg) {
        return ResponseEntity.ok(ApiResponse.ok(service.save(cfg)));
    }
}
