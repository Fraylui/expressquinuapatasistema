package com.expressvraem.modules.rutas.controller;

import com.expressvraem.modules.rutas.entity.Ruta;
import com.expressvraem.modules.rutas.repository.RutaRepository;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.middleware.AgenciaContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rutas")
@RequiredArgsConstructor
public class RutaController {

    private final RutaRepository rutaRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Ruta>>> listar() {
        Long agenciaId = AgenciaContext.getAgenciaId();
        List<Ruta> rutas = agenciaId != null
                ? rutaRepository.findByAgenciaIdAndActivoTrue(agenciaId)
                : rutaRepository.findByActivoTrue();
        return ResponseEntity.ok(ApiResponse.ok(rutas));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Ruta>> detalle(@PathVariable Long id) {
        return rutaRepository.findById(id)
                .map(r -> ResponseEntity.ok(ApiResponse.ok(r)))
                .orElse(ResponseEntity.notFound().build());
    }
}
