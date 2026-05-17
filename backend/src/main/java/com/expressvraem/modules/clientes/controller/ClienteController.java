package com.expressvraem.modules.clientes.controller;

import com.expressvraem.modules.clientes.dto.ClienteDTO;
import com.expressvraem.modules.clientes.entity.Cliente;
import com.expressvraem.modules.clientes.service.ClienteService;
import com.expressvraem.shared.exceptions.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/clientes")
@RequiredArgsConstructor
public class ClienteController {

    private final ClienteService clienteService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Cliente>>> listar(
            @RequestParam(required = false) String q) {
        List<Cliente> clientes = (q != null && !q.isBlank())
                ? clienteService.buscar(q)
                : clienteService.listar();
        return ResponseEntity.ok(ApiResponse.ok(clientes));
    }

    @GetMapping("/buscar")
    public ResponseEntity<ApiResponse<Cliente>> buscarPorDoc(
            @RequestParam(required = false) String tipoDoc,
            @RequestParam(required = false) String numDoc,
            @RequestParam(required = false) String dni,
            @RequestParam(required = false) String ruc) {

        // Soporte nuevo: buscar por dni o ruc directo
        if (dni != null && !dni.isBlank()) {
            return ResponseEntity.ok(ApiResponse.ok(clienteService.buscarPorDni(dni)));
        }
        if (ruc != null && !ruc.isBlank()) {
            return ResponseEntity.ok(ApiResponse.ok(clienteService.buscarPorRuc(ruc)));
        }
        // Soporte legacy: tipoDoc + numDoc
        return ResponseEntity.ok(ApiResponse.ok(clienteService.buscarPorDoc(tipoDoc, numDoc)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Cliente>> detalle(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(clienteService.findById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Cliente>> crear(@Valid @RequestBody ClienteDTO dto) {
        return ResponseEntity.ok(ApiResponse.ok("Cliente registrado", clienteService.crear(dto)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Cliente>> actualizar(
            @PathVariable Long id, @Valid @RequestBody ClienteDTO dto) {
        return ResponseEntity.ok(ApiResponse.ok("Cliente actualizado", clienteService.actualizar(id, dto)));
    }
}
