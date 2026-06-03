package com.expressvraem.modules.clientes.service;

import com.expressvraem.modules.auditoria.entity.Auditoria;
import com.expressvraem.modules.auditoria.service.AuditoriaService;
import com.expressvraem.modules.clientes.dto.ClienteDTO;
import com.expressvraem.modules.clientes.entity.Cliente;
import com.expressvraem.modules.clientes.repository.ClienteRepository;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import com.expressvraem.shared.middleware.AgenciaContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClienteService {

    private final ClienteRepository clienteRepository;
    private final AuditoriaService auditoriaService;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null && auth.isAuthenticated()) ? auth.getName() : "sistema";
    }

    private static String toJson(Cliente c) {
        if (c == null) return null;
        try {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",       c.getId());
            m.put("tipo",     c.getTipo());
            m.put("tipoDoc",  c.getTipoDoc());
            m.put("numDoc",   c.getNumDoc());
            m.put("nombres",  c.getNombres());
            m.put("apellidos",c.getApellidos());
            m.put("telefono", c.getTelefono());
            m.put("email",    c.getEmail());
            return MAPPER.writeValueAsString(m);
        } catch (Exception e) { return null; }
    }

    private void audit(String accion, Long registroId, Long agenciaId,
                       String antes, String despues) {
        try {
            auditoriaService.registrar(Auditoria.builder()
                    .usuarioNombre(currentUser())
                    .agenciaId(agenciaId)
                    .accion(accion).modulo("CLIENTES").entidad("CLIENTE")
                    .registroId(registroId)
                    .datosAntes(antes).datosDespues(despues)
                    .build());
        } catch (Exception e) {
            log.warn("Audit CLIENTES falló: {}", e.getMessage());
        }
    }

    public List<Cliente> listar() {
        Long agenciaId = AgenciaContext.getAgenciaId();
        if (agenciaId != null) return clienteRepository.findByAgenciaIdOrderByApellidosAsc(agenciaId);
        return clienteRepository.findAll();
    }

    public Cliente buscarPorDoc(String tipoDoc, String numDoc) {
        return clienteRepository.findByTipoDocAndNumDoc(tipoDoc, numDoc)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente", numDoc));
    }

    public Cliente buscarPorDni(String dni) {
        return clienteRepository.findByDni(dni)
                .orElseGet(() -> clienteRepository.findByTipoDocAndNumDoc("DNI", dni)
                        .orElseThrow(() -> new ResourceNotFoundException("Cliente con DNI", dni)));
    }

    public Cliente buscarPorRuc(String ruc) {
        return clienteRepository.findByRuc(ruc)
                .orElseGet(() -> clienteRepository.findByTipoDocAndNumDoc("RUC", ruc)
                        .orElseThrow(() -> new ResourceNotFoundException("Cliente con RUC", ruc)));
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
        boolean empresa = dto.isEmpresa();
        Cliente c = Cliente.builder()
                .agenciaId(agenciaId != null ? agenciaId : 1L)
                .tipo(empresa ? "EMPRESA" : "PERSONA")
                .razonSocial(empresa ? dto.getRazonSocial() : null)
                .nombres(dto.getNombres() != null ? dto.getNombres()
                        : (empresa && dto.getRazonSocial() != null ? dto.getRazonSocial() : dto.getNumDoc()))
                .apellidos(dto.getApellidos() != null ? dto.getApellidos() : "-")
                .tipoDoc(dto.getTipoDoc())
                .numDoc(dto.getNumDoc())
                .dni(empresa ? dto.getDniContacto() : dto.getNumDoc().length() == 8 ? dto.getNumDoc() : null)
                .telefono(dto.getTelefono())
                .email(dto.getEmail())
                .fechaNac(dto.getFechaNac())
                .direccion(dto.getDireccion())
                .build();
        Cliente saved = clienteRepository.save(c);
        audit("INSERT", saved.getId(), saved.getAgenciaId(), null, toJson(saved));
        return saved;
    }

    public Cliente actualizar(Long id, ClienteDTO dto) {
        Cliente c = clienteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente", id));
        String antes = toJson(c);
        boolean empresa = dto.isEmpresa();
        c.setTipo(empresa ? "EMPRESA" : "PERSONA");
        c.setRazonSocial(empresa ? dto.getRazonSocial() : null);
        c.setNombres(dto.getNombres() != null ? dto.getNombres()
                : (empresa && dto.getRazonSocial() != null ? dto.getRazonSocial() : dto.getNumDoc()));
        c.setApellidos(dto.getApellidos() != null ? dto.getApellidos() : "-");
        c.setTipoDoc(dto.getTipoDoc());
        c.setNumDoc(dto.getNumDoc());
        c.setDni(empresa ? dto.getDniContacto()
                : (dto.getNumDoc() != null && dto.getNumDoc().length() == 8 ? dto.getNumDoc() : null));
        c.setTelefono(dto.getTelefono());
        c.setEmail(dto.getEmail());
        c.setFechaNac(dto.getFechaNac());
        c.setDireccion(dto.getDireccion());
        Cliente saved = clienteRepository.save(c);
        audit("UPDATE", saved.getId(), saved.getAgenciaId(), antes, toJson(saved));
        return saved;
    }

    public void eliminar(Long id) {
        Cliente c = clienteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente", id));
        try {
            String antes = toJson(c);
            clienteRepository.deleteById(id);
            audit("DELETE", id, c.getAgenciaId(), antes, null);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            throw new com.expressvraem.shared.exceptions.BusinessException(
                    "No se puede eliminar: el cliente tiene registros asociados (pasajes, encomiendas)", "CLIENTE_CON_REFERENCIAS");
        }
    }

    @org.springframework.transaction.annotation.Transactional
    public Cliente findOrCreate(String tipoDoc, String numDoc,
                                String nombres, String apellidos,
                                String razonSocial, String telefono,
                                Long agenciaId) {
        return clienteRepository.findByTipoDocAndNumDoc(tipoDoc, numDoc)
                .orElseGet(() -> {
                    boolean empresa = "RUC".equals(tipoDoc);
                    String nomFinal = empresa ? (razonSocial != null ? razonSocial.substring(0, Math.min(razonSocial.length(), 80)) : numDoc) : (nombres != null ? nombres : numDoc);
                    String apeFinal = empresa ? "-" : (apellidos != null ? apellidos : "-");
                    Cliente c = Cliente.builder()
                            .agenciaId(agenciaId != null ? agenciaId : 1L)
                            .tipo(empresa ? "EMPRESA" : "PERSONA")
                            .razonSocial(empresa ? razonSocial : null)
                            .nombres(nomFinal)
                            .apellidos(apeFinal)
                            .tipoDoc(tipoDoc)
                            .numDoc(numDoc)
                            .telefono(telefono)
                            .build();
                    return clienteRepository.save(c);
                });
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
