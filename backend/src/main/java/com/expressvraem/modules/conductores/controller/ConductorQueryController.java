package com.expressvraem.modules.conductores.controller;

import com.expressvraem.modules.conductores.entity.Conductor;
import com.expressvraem.modules.conductores.repository.ConductorRepository;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.middleware.AgenciaContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/conductores")
@RequiredArgsConstructor
public class ConductorQueryController {

    private final ConductorRepository conductorRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Conductor>>> listar() {
        Long agenciaId = AgenciaContext.getAgenciaId();
        List<Conductor> lista = agenciaId != null
                ? conductorRepository.findByAgenciaIdAndActivo(agenciaId, true)
                : conductorRepository.findAll().stream().filter(Conductor::isActivo).toList();
        return ResponseEntity.ok(ApiResponse.ok(lista));
    }
}
