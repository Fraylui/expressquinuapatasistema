package com.expressvraem.modules.manifiestos.controller;

import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.modules.encomiendas.entity.Encomienda;
import com.expressvraem.modules.encomiendas.repository.EncomiendaRepository;
import com.expressvraem.modules.manifiestos.dto.ManifiestoDTO;
import com.expressvraem.modules.manifiestos.entity.Manifiesto;
import com.expressvraem.modules.manifiestos.repository.ManifiestoRepository;
import com.expressvraem.modules.manifiestos.service.ManifiestoPdfService;
import com.expressvraem.modules.pasajes.entity.Pasaje;
import com.expressvraem.modules.pasajes.repository.PasajeRepository;
import com.expressvraem.modules.viajes.entity.Viaje;
import com.expressvraem.modules.viajes.repository.ViajeRepository;
import com.expressvraem.shared.annotations.RequiereModulo;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import com.expressvraem.shared.middleware.AgenciaContext;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/manifiestos")
@RequiredArgsConstructor
@Slf4j
public class ManifiestoController {

    private final ViajeRepository        viajeRepository;
    private final PasajeRepository       pasajeRepository;
    private final EncomiendaRepository   encomiendaRepository;
    private final ManifiestoRepository   manifiestoRepository;
    private final ManifiestoPdfService   pdfService;
    private final UsuarioRepository      usuarioRepository;
    private final EntityManager          entityManager;


    @GetMapping("/viaje/{viajeId}")
    @RequiereModulo("MANIFIESTOS")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<Map<String, Object>>> porViaje(@PathVariable Long viajeId) {
        try {
            checkAgenciaAccess(viajeId);
            ManifiestoDTO datos = buildManifiesto(viajeId);
            Manifiesto m = manifiestoRepository.findByViajeId(viajeId).orElse(null);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("datos", datos);
            result.put("manifiesto", m);
            return ResponseEntity.ok(ApiResponse.ok(result));
        } catch (Exception e) {
            log.error("porViaje error viajeId={}: {} — {}", viajeId,
                    e.getClass().getName(), e.getMessage(), e);
            throw e;
        }
    }


    @PostMapping("/generar/{viajeId}")
    @RequiereModulo("MANIFIESTOS")
    public ResponseEntity<ApiResponse<Manifiesto>> generar(
            @PathVariable Long viajeId,
            Authentication auth) {
        checkAgenciaAccess(viajeId);
        Viaje viaje = viajeRepository.findById(viajeId)
                .orElseThrow(() -> new ResourceNotFoundException("Viaje", viajeId));
        Long userId = usuarioRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new BusinessException("Usuario no encontrado", "USER_NOT_FOUND"))
                .getId();

        Manifiesto m = manifiestoRepository.findByViajeId(viajeId).orElseGet(() -> {
            String numero = generarNumero(viaje.getAgenciaId());
            return Manifiesto.builder()
                    .agenciaId(viaje.getAgenciaId())
                    .viajeId(viajeId)
                    .generadoPor(userId)
                    .numero(numero)
                    .estado("EMITIDO")
                    .build();
        });

        int totalPasajeros = pasajeRepository.findActivosByViajeId(viajeId).size();
        int totalEncomiendas = encomiendaRepository.findByViajeId(viajeId).size();
        m.setTotalPasajeros(totalPasajeros);
        m.setTotalEncomiendas(totalEncomiendas);
        m.setGeneradoPor(userId);
        m.setEstado("EMITIDO");

        Manifiesto saved = manifiestoRepository.save(m);
        log.info("Manifiesto generado: id={} viaje={}", saved.getId(), viajeId);
        return ResponseEntity.ok(ApiResponse.ok("Manifiesto generado", saved));
    }


    @GetMapping
    @RequiereModulo("MANIFIESTOS")
    public ResponseEntity<ApiResponse<List<Manifiesto>>> lista() {
        Long agenciaId = AgenciaContext.getAgenciaId();
        List<Manifiesto> lista = agenciaId != null
                ? manifiestoRepository.findByAgenciaIdOrderByCreatedAtDesc(agenciaId)
                : manifiestoRepository.findAllByOrderByCreatedAtDesc();
        return ResponseEntity.ok(ApiResponse.ok(lista));
    }


    @GetMapping("/{viajeId}/datos")
    @RequiereModulo("MANIFIESTOS")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<ManifiestoDTO>> datos(@PathVariable Long viajeId) {
        checkAgenciaAccess(viajeId);
        ManifiestoDTO dto = buildManifiesto(viajeId);
        return ResponseEntity.ok(ApiResponse.ok(dto));
    }


    @GetMapping("/{viajeId}/pdf")
    @RequiereModulo("MANIFIESTOS")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> pdf(@PathVariable Long viajeId) {
        try {
            checkAgenciaAccess(viajeId);
            ManifiestoDTO dto = buildManifiesto(viajeId);
            byte[] bytes = pdfService.generarManifiesto(dto);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"manifiesto-viaje-" + viajeId + ".pdf\"")
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE)
                    .body(bytes);
        } catch (Exception e) {
            log.error("Error generando PDF manifiesto viaje {}: {}", viajeId, e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }


    @GetMapping("/{viajeId}/pdf/encomiendas")
    @RequiereModulo("MANIFIESTOS")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> pdfEncomiendas(@PathVariable Long viajeId) {
        try {
            checkAgenciaAccess(viajeId);
            ManifiestoDTO dto = buildManifiesto(viajeId);
            byte[] bytes = pdfService.generarManifiestoEncomiendas(dto);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"encomiendas-viaje-" + viajeId + ".pdf\"")
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE)
                    .body(bytes);
        } catch (Exception e) {
            log.error("Error generando PDF encomiendas viaje {}: {}", viajeId, e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }


    @GetMapping("/ticket/{pasajeId}/pdf")
    @RequiereModulo("MANIFIESTOS")
    public ResponseEntity<byte[]> ticketPdf(@PathVariable Long pasajeId) {
        try {
            Pasaje p = pasajeRepository.findById(pasajeId)
                    .orElseThrow(() -> new ResourceNotFoundException("Pasaje", pasajeId));
            ManifiestoPdfService.TicketData ticket = buildTicketData(p);
            byte[] bytes = pdfService.generarTicket(ticket);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"ticket-" + p.getCorrelativo() + ".pdf\"")
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE)
                    .body(bytes);
        } catch (Exception e) {
            log.error("Error generando ticket pasaje {}: {}", pasajeId, e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }


    @PostMapping("/{viajeId}/guardar")
    @RequiereModulo("MANIFIESTOS")
    public ResponseEntity<ApiResponse<Manifiesto>> guardar(
            @PathVariable Long viajeId,
            @RequestBody(required = false) Map<String, String> body,
            Authentication auth) {
        checkAgenciaAccess(viajeId);
        Viaje viaje = viajeRepository.findById(viajeId)
                .orElseThrow(() -> new ResourceNotFoundException("Viaje", viajeId));
        Long userId = usuarioRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new BusinessException("Usuario no encontrado", "USER_NOT_FOUND"))
                .getId();

        String nuevoEstado = (body != null && body.containsKey("estado")) ? body.get("estado") : null;

        Manifiesto m = manifiestoRepository.findByViajeId(viajeId).orElseGet(() -> {
            String numero = generarNumero(viaje.getAgenciaId());
            return Manifiesto.builder()
                    .agenciaId(viaje.getAgenciaId())
                    .viajeId(viajeId)
                    .generadoPor(userId)
                    .numero(numero)
                    .estado("BORRADOR")
                    .build();
        });

        int totalPasajeros = pasajeRepository.findActivosByViajeId(viajeId).size();
        int totalEncomiendas = encomiendaRepository.findByViajeId(viajeId).size();
        m.setTotalPasajeros(totalPasajeros);
        m.setTotalEncomiendas(totalEncomiendas);
        m.setGeneradoPor(userId);
        if (nuevoEstado != null) m.setEstado(nuevoEstado);

        Manifiesto saved = manifiestoRepository.save(m);
        log.info("Manifiesto guardado: id={} viaje={} estado={}", saved.getId(), viajeId, saved.getEstado());
        return ResponseEntity.ok(ApiResponse.ok("Manifiesto guardado", saved));
    }


    @PatchMapping("/{id}/estado")
    @RequiereModulo("MANIFIESTOS")
    public ResponseEntity<ApiResponse<Manifiesto>> cambiarEstado(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        Manifiesto m = manifiestoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Manifiesto", id));
        String estado = body.get("estado");
        if (estado == null || !List.of("BORRADOR", "EMITIDO", "ENVIADO").contains(estado)) {
            throw new BusinessException("Estado inválido", "ESTADO_INVALIDO");
        }
        m.setEstado(estado);
        return ResponseEntity.ok(ApiResponse.ok("Estado actualizado", manifiestoRepository.save(m)));
    }

    private ManifiestoDTO buildManifiesto(Long viajeId) {
        Viaje viaje = viajeRepository.findById(viajeId)
                .orElseThrow(() -> new ResourceNotFoundException("Viaje", viajeId));

        ManifiestoDTO dto = new ManifiestoDTO();
        dto.setViajeId(viajeId);
        dto.setEstado(viaje.getEstado());
        dto.setFechaHoraSal(viaje.getFechaHoraSal());
        dto.setFechaHoraArr(viaje.getFechaHoraArr());

        try {
            Object[] ruta = (Object[]) entityManager
                    .createNativeQuery("SELECT origen, destino, distancia_km FROM rutas WHERE id = :id")
                    .setParameter("id", viaje.getRutaId())
                    .getSingleResult();
            dto.setRutaOrigen(str(ruta[0]));
            dto.setRutaDestino(str(ruta[1]));
            dto.setDistanciaKm(ruta[2] != null ? ((Number) ruta[2]).doubleValue() : null);
        } catch (Exception e) {
            log.warn("No se pudo resolver ruta {} para manifiesto viaje {}: {}", viaje.getRutaId(), viajeId, e.getMessage());
        }

        try {
            Object[] veh = (Object[]) entityManager
                    .createNativeQuery("SELECT placa, tipo, num_asientos FROM vehiculos WHERE id = :id")
                    .setParameter("id", viaje.getVehiculoId())
                    .getSingleResult();
            dto.setVehiculoPlaca(str(veh[0]));
            dto.setVehiculoTipo(str(veh[1]));
            dto.setVehiculoAsientos(veh[2] != null ? ((Number) veh[2]).intValue() : null);
        } catch (Exception e) {
            log.warn("No se pudo resolver vehiculo {} para manifiesto viaje {}: {}", viaje.getVehiculoId(), viajeId, e.getMessage());
        }

        if (viaje.getConductorId() != null) {
            try {
                Object[] cond = (Object[]) entityManager
                        .createNativeQuery("SELECT nombres || ' ' || apellidos, licencia FROM conductores WHERE id = :id")
                        .setParameter("id", viaje.getConductorId())
                        .getSingleResult();
                dto.setConductorNombre(str(cond[0]));
                dto.setConductorLicencia(str(cond[1]));
            } catch (Exception e) {
                log.warn("No se pudo resolver conductor {} para manifiesto viaje {}: {}", viaje.getConductorId(), viajeId, e.getMessage());
            }
        }

        try {
            Object[] ag = (Object[]) entityManager
                    .createNativeQuery("SELECT nombre, direccion, ruc FROM agencias WHERE id = :id")
                    .setParameter("id", viaje.getAgenciaId())
                    .getSingleResult();
            dto.setAgenciaNombre(str(ag[0]));
            dto.setAgenciaDireccion(str(ag[1]));
            dto.setAgenciaRuc(str(ag[2]));
        } catch (Exception e) {
            log.warn("No se pudo resolver agencia {} para manifiesto viaje {}: {}", viaje.getAgenciaId(), viajeId, e.getMessage());
        }

        List<Pasaje> pasajes = pasajeRepository.findActivosByViajeId(viajeId);
        List<ManifiestoDTO.PasajeroItem> pasajeroItems = new ArrayList<>();
        BigDecimal totalRec = BigDecimal.ZERO;

        for (int i = 0; i < pasajes.size(); i++) {
            Pasaje p = pasajes.get(i);
            ManifiestoDTO.PasajeroItem item = new ManifiestoDTO.PasajeroItem();
            item.setItem(i + 1);
            item.setPasajeId(p.getId());
            item.setCorrelativo(p.getCorrelativo());
            item.setPrecioFinal(p.getPrecioFinal());
            item.setFormaPago(p.getFormaPago());
            item.setEstadoPasaje(p.getEstado());
            if (p.getPrecioFinal() != null) totalRec = totalRec.add(p.getPrecioFinal());

            item.setNumAsiento(p.getAsientoNumero() != null ? p.getAsientoNumero() : 0);

            try {
                Object[] cl = (Object[]) entityManager
                        .createNativeQuery("SELECT nombres, apellidos, tipo_doc, num_doc FROM clientes WHERE id = :id")
                        .setParameter("id", p.getClienteId())
                        .getSingleResult();
                item.setNombres(str(cl[0]));
                item.setApellidos(str(cl[1]));
                item.setTipoDoc(str(cl[2]));
                item.setNumDoc(str(cl[3]));
            } catch (Exception e) {
                log.warn("Cliente no encontrado para pasaje {}: {}", p.getId(), e.getMessage());
                item.setNombres("—"); item.setApellidos("—");
                item.setTipoDoc("—"); item.setNumDoc("—");
            }

            pasajeroItems.add(item);
        }

        dto.setPasajeros(pasajeroItems);
        dto.setTotalPasajeros(pasajeroItems.size());
        dto.setTotalRecaudado(totalRec);

        List<Encomienda> encomiendas = encomiendaRepository.findByViajeId(viajeId);
        List<ManifiestoDTO.EncomiendaItem> encItems = new ArrayList<>();
        BigDecimal totalEnc = BigDecimal.ZERO;

        for (int i = 0; i < encomiendas.size(); i++) {
            Encomienda enc = encomiendas.get(i);
            ManifiestoDTO.EncomiendaItem ei = new ManifiestoDTO.EncomiendaItem();
            ei.setItem(i + 1);
            ei.setEncomiendaId(enc.getId());
            ei.setCodigoTracking(enc.getCodigoTracking());
            ei.setDescripcion(enc.getDescripcion());
            ei.setPesoKg(enc.getPesoKg());
            ei.setNumBultos(enc.getNumBultos());
            ei.setPrecioEnvio(enc.getPrecioEnvio());
            ei.setFormaCobro(enc.getFormaCobro());
            ei.setEstado(enc.getEstado());
            if (enc.getPrecioEnvio() != null) totalEnc = totalEnc.add(enc.getPrecioEnvio());

            ei.setRemitente(resolveNombreCliente(enc.getRemitenteId()));
            ei.setDestinatario(resolveNombreCliente(enc.getDestinatarioId()));
            encItems.add(ei);
        }

        dto.setEncomiendas(encItems);
        dto.setTotalEncomiendas(encItems.size());
        dto.setTotalMontoEncomiendas(totalEnc);

        return dto;
    }

    private String resolveNombreCliente(Long clienteId) {
        if (clienteId == null) return "—";
        try {
            Object[] cl = (Object[]) entityManager
                    .createNativeQuery("SELECT apellidos, nombres FROM clientes WHERE id = :id")
                    .setParameter("id", clienteId)
                    .getSingleResult();
            return str(cl[0]) + ", " + str(cl[1]);
        } catch (Exception e) {
            log.warn("Cliente {} no encontrado: {}", clienteId, e.getMessage());
            return "—";
        }
    }

    private ManifiestoPdfService.TicketData buildTicketData(Pasaje p) {
        String origen = "—", destino = "—", fecha = "—", hora = "—";
        String placa = "—", tipo = "—", ruc = "—", agenciaNombre = "—";

        try {
            Object[] viajeRow = (Object[]) entityManager
                    .createNativeQuery(
                        "SELECT v.fecha_hora_sal, r.origen, r.destino, ve.placa, ve.tipo, a.ruc, a.nombre " +
                        "FROM viajes v " +
                        "JOIN rutas r ON r.id = v.ruta_id " +
                        "JOIN vehiculos ve ON ve.id = v.vehiculo_id " +
                        "JOIN agencias a ON a.id = v.agencia_id " +
                        "WHERE v.id = :id")
                    .setParameter("id", p.getViajeId())
                    .getSingleResult();
            java.time.OffsetDateTime fh = null;
            if (viajeRow[0] instanceof java.sql.Timestamp ts) {
                fh = ts.toInstant().atOffset(java.time.ZoneOffset.of("-05:00"));
            } else if (viajeRow[0] instanceof java.time.OffsetDateTime odt) {
                fh = odt;
            }
            if (fh != null) {
                fecha = fh.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
                hora  = fh.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm"));
            }
            origen       = str(viajeRow[1]);
            destino      = str(viajeRow[2]);
            placa        = str(viajeRow[3]);
            tipo         = str(viajeRow[4]);
            ruc          = str(viajeRow[5]);
            agenciaNombre= str(viajeRow[6]);
        } catch (Exception e) {
            log.warn("No se pudo resolver datos del viaje para ticket pasaje {}: {}", p.getId(), e.getMessage());
        }

        String pasajeroNombre = "—", tipoDoc = "DNI", numDoc = "—";
        try {
            Object[] cl = (Object[]) entityManager
                    .createNativeQuery("SELECT nombres, apellidos, tipo_doc, num_doc FROM clientes WHERE id = :id")
                    .setParameter("id", p.getClienteId())
                    .getSingleResult();
            pasajeroNombre = str(cl[1]) + ", " + str(cl[0]);
            tipoDoc = str(cl[2]);
            numDoc  = str(cl[3]);
        } catch (Exception e) {
            log.warn("Cliente no encontrado para ticket pasaje {}: {}", p.getId(), e.getMessage());
        }

        String numAsiento = p.getAsientoNumero() != null
                ? String.valueOf(p.getAsientoNumero()) : "—";

        return new ManifiestoPdfService.TicketData(
                ruc, p.getSerie(), p.getCorrelativo(),
                origen, destino, fecha, hora,
                pasajeroNombre, tipoDoc, numDoc,
                numAsiento, p.getPrecioFinal(),
                placa, tipo, agenciaNombre
        );
    }

    private void checkAgenciaAccess(Long viajeId) {
        Long agenciaId = AgenciaContext.getAgenciaId();
        if (agenciaId == null) return; // SUPER_ADMIN/GERENTE — acceso total
        Viaje viaje = viajeRepository.findById(viajeId)
                .orElseThrow(() -> new ResourceNotFoundException("Viaje", viajeId));
        if (!agenciaId.equals(viaje.getAgenciaId())) {
            throw new BusinessException("No tiene acceso a este viaje", "ACCESO_DENEGADO");
        }
    }

    private String generarNumero(Long agenciaId) {
        int año = LocalDateTime.now().getYear();
        long count = manifiestoRepository.count() + 1;
        return String.format("MAN-%d-%05d", año, count);
    }

    private String str(Object o) { return o != null ? String.valueOf(o) : "—"; }
}
