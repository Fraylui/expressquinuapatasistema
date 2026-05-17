package com.expressvraem.modules.clientes.service;

import com.expressvraem.modules.clientes.dto.ClienteDTO;
import com.expressvraem.modules.clientes.entity.Cliente;
import com.expressvraem.modules.clientes.repository.ClienteRepository;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import com.expressvraem.shared.logs.LogService;
import com.expressvraem.shared.middleware.AgenciaContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClienteService {

    private final ClienteRepository clienteRepository;
    private final LogService logService;

    public List<Cliente> listar() {
        Long agenciaId = AgenciaContext.getAgenciaId();
        if (agenciaId != null) return clienteRepository.findByAgenciaIdOrderByApellidosAsc(agenciaId);
        return clienteRepository.findAll();
    }

    public Cliente buscarPorDoc(String tipoDoc, String numDoc) {
        return clienteRepository.findByTipoDocAndNumDoc(tipoDoc, numDoc)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente", numDoc));
    }

    public List<Cliente> buscar(String q) {
        Long agenciaId = AgenciaContext.getAgenciaId();
        if (agenciaId == null) return List.of();
        if (q == null || q.isBlank()) return clienteRepository.findByAgenciaIdOrderByApellidosAsc(agenciaId);
        // Try num_doc match first (faster for DNI lookup)
        List<Cliente> byDoc = clienteRepository.findByAgenciaIdAndNumDocContainingIgnoreCase(agenciaId, q);
        if (!byDoc.isEmpty()) return byDoc;
        return clienteRepository.findByAgenciaIdAndApellidosContainingIgnoreCaseOrAgenciaIdAndNombresContainingIgnoreCase(
                agenciaId, q, agenciaId, q);
    }

    public Cliente crear(ClienteDTO dto) {
        Long agenciaId = AgenciaContext.getAgenciaId();
        Cliente c = Cliente.builder()
                .agenciaId(agenciaId != null ? agenciaId : 1L)
                .nombres(dto.getNombres())
                .apellidos(dto.getApellidos())
                .tipoDoc(dto.getTipoDoc())
                .numDoc(dto.getNumDoc())
                .telefono(dto.getTelefono())
                .email(dto.getEmail())
                .fechaNac(dto.getFechaNac())
                .build();
        Cliente saved = clienteRepository.save(c);
        logService.logOperacion("sistema", "CLIENTES", "CREAR", saved);
        return saved;
    }

    public Cliente actualizar(Long id, ClienteDTO dto) {
        Cliente c = clienteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente", id));
        c.setNombres(dto.getNombres());
        c.setApellidos(dto.getApellidos());
        c.setTipoDoc(dto.getTipoDoc());
        c.setNumDoc(dto.getNumDoc());
        c.setTelefono(dto.getTelefono());
        c.setEmail(dto.getEmail());
        c.setFechaNac(dto.getFechaNac());
        return clienteRepository.save(c);
    }

    public Cliente findById(Long id) {
        Cliente c = clienteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente", id));
        Long agenciaId = AgenciaContext.getAgenciaId();
        if (agenciaId != null && !agenciaId.equals(c.getAgenciaId())) {
            throw new AccessDeniedException("No tiene acceso a este cliente");
        }
        return c;
    }
}
