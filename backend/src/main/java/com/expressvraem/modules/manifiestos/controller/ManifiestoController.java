package com.expressvraem.modules.manifiestos.controller;

import com.expressvraem.modules.manifiestos.dto.ManifiestoDTO;
import com.expressvraem.modules.manifiestos.service.ManifiestoPdfService;
import com.expressvraem.modules.pasajes.entity.Pasaje;
import com.expressvraem.modules.pasajes.repository.PasajeRepository;
import com.expressvraem.modules.viajes.entity.Viaje;
import com.expressvraem.modules.viajes.repository.ViajeRepository;
import com.expressvraem.shared.annotations.RequiereModulo;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/manifiestos")
@RequiredArgsConstructor
@Slf4j
public class ManifiestoController {

    private final ViajeRepository     viajeRepository;
    private final PasajeRepository    pasajeRepository;
    private final ManifiestoPdfService pdfService;
    private final EntityManager        entityManager;

    /** JSON con todos los datos del manifiesto */
    @GetMapping("/{viajeId}/datos")
    @RequiereModulo("MANIFIESTOS")
    public ResponseEntity<ApiResponse<ManifiestoDTO>> datos(@PathVariable Long viajeId) {
        ManifiestoDTO dto = buildManifiesto(viajeId);
        return ResponseEntity.ok(ApiResponse.ok(dto));
    }

    /** PDF descargable del manifiesto */
    @GetMapping("/{viajeId}/pdf")
    @RequiereModulo("MANIFIESTOS")
    public ResponseEntity<byte[]> pdf(@PathVariable Long viajeId) {
        try {
            ManifiestoDTO dto = buildManifiesto(viajeId);
            byte[] bytes = pdfService.generarManifiesto(dto);

            String filename = "manifiesto-viaje-" + viajeId + ".pdf";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE)
                    .body(bytes);
        } catch (Exception e) {
            log.error("Error generando PDF manifiesto viaje {}: {}", viajeId, e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /** PDF del ticket de un pasaje individual */
    @GetMapping("/ticket/{pasajeId}/pdf")
    @RequiereModulo("VENTAS")
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

    // ─────────────────────────────────────────────────────────────────────────

    private ManifiestoDTO buildManifiesto(Long viajeId) {
        Viaje viaje = viajeRepository.findById(viajeId)
                .orElseThrow(() -> new ResourceNotFoundException("Viaje", viajeId));

        ManifiestoDTO dto = new ManifiestoDTO();
        dto.setViajeId(viajeId);
        dto.setEstado(viaje.getEstado());
        dto.setFechaHoraSal(viaje.getFechaHoraSal());
        dto.setFechaHoraArr(viaje.getFechaHoraArr());

        // Ruta
        try {
            Object[] ruta = (Object[]) entityManager
                    .createNativeQuery("SELECT origen, destino, distancia_km FROM rutas WHERE id = :id")
                    .setParameter("id", viaje.getRutaId())
                    .getSingleResult();
            dto.setRutaOrigen(str(ruta[0]));
            dto.setRutaDestino(str(ruta[1]));
            dto.setDistanciaKm(ruta[2] != null ? ((Number) ruta[2]).doubleValue() : null);
        } catch (Exception ignored) {}

        // Vehículo
        try {
            Object[] veh = (Object[]) entityManager
                    .createNativeQuery("SELECT placa, tipo, num_asientos FROM vehiculos WHERE id = :id")
                    .setParameter("id", viaje.getVehiculoId())
                    .getSingleResult();
            dto.setVehiculoPlaca(str(veh[0]));
            dto.setVehiculoTipo(str(veh[1]));
            dto.setVehiculoAsientos(veh[2] != null ? ((Number) veh[2]).intValue() : null);
        } catch (Exception ignored) {}

        // Conductor
        if (viaje.getConductorId() != null) {
            try {
                Object[] cond = (Object[]) entityManager
                        .createNativeQuery("SELECT nombres || ' ' || apellidos, licencia FROM conductores WHERE id = :id")
                        .setParameter("id", viaje.getConductorId())
                        .getSingleResult();
                dto.setConductorNombre(str(cond[0]));
                dto.setConductorLicencia(str(cond[1]));
            } catch (Exception ignored) {}
        }

        // Agencia
        try {
            Object[] ag = (Object[]) entityManager
                    .createNativeQuery("SELECT nombre, direccion, ruc FROM agencias WHERE id = :id")
                    .setParameter("id", viaje.getAgenciaId())
                    .getSingleResult();
            dto.setAgenciaNombre(str(ag[0]));
            dto.setAgenciaDireccion(str(ag[1]));
            dto.setAgenciaRuc(str(ag[2]));
        } catch (Exception ignored) {}

        // Pasajeros
        List<Pasaje> pasajes = pasajeRepository.findActivosByViajeId(viajeId);
        List<ManifiestoDTO.PasajeroItem> items = new ArrayList<>();
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

            if (p.getPrecioFinal() != null) {
                totalRec = totalRec.add(p.getPrecioFinal());
            }

            // Asiento
            try {
                Object[] as = (Object[]) entityManager
                        .createNativeQuery("SELECT numero FROM asientos WHERE id = :id")
                        .setParameter("id", p.getAsientoId())
                        .getSingleResult();
                item.setNumAsiento(((Number) as[0]).intValue());
            } catch (Exception ignored) { item.setNumAsiento(0); }

            // Cliente
            try {
                Object[] cl = (Object[]) entityManager
                        .createNativeQuery("SELECT nombres, apellidos, tipo_doc, num_doc FROM clientes WHERE id = :id")
                        .setParameter("id", p.getClienteId())
                        .getSingleResult();
                item.setNombres(str(cl[0]));
                item.setApellidos(str(cl[1]));
                item.setTipoDoc(str(cl[2]));
                item.setNumDoc(str(cl[3]));
            } catch (Exception ignored) {
                item.setNombres("—");
                item.setApellidos("—");
                item.setTipoDoc("—");
                item.setNumDoc("—");
            }

            items.add(item);
        }

        dto.setPasajeros(items);
        dto.setTotalPasajeros(items.size());
        dto.setTotalRecaudado(totalRec);

        return dto;
    }

    private ManifiestoPdfService.TicketData buildTicketData(Pasaje p) {
        String origen = "—", destino = "—", fecha = "—", hora = "—";
        String placa = "—", tipo = "—", ruc = "—";

        try {
            Object[] viajeRow = (Object[]) entityManager
                    .createNativeQuery(
                        "SELECT v.fecha_hora_sal, r.origen, r.destino, ve.placa, ve.tipo, a.ruc " +
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
            origen  = str(viajeRow[1]);
            destino = str(viajeRow[2]);
            placa   = str(viajeRow[3]);
            tipo    = str(viajeRow[4]);
            ruc     = str(viajeRow[5]);
        } catch (Exception ignored) {}

        String pasajeroNombre = "—", tipoDoc = "DNI", numDoc = "—";
        try {
            Object[] cl = (Object[]) entityManager
                    .createNativeQuery("SELECT nombres, apellidos, tipo_doc, num_doc FROM clientes WHERE id = :id")
                    .setParameter("id", p.getClienteId())
                    .getSingleResult();
            pasajeroNombre = str(cl[1]) + ", " + str(cl[0]);
            tipoDoc = str(cl[2]);
            numDoc  = str(cl[3]);
        } catch (Exception ignored) {}

        String numAsiento = "—";
        try {
            Object[] as = (Object[]) entityManager
                    .createNativeQuery("SELECT numero FROM asientos WHERE id = :id")
                    .setParameter("id", p.getAsientoId())
                    .getSingleResult();
            numAsiento = String.valueOf(((Number) as[0]).intValue());
        } catch (Exception ignored) {}

        return new ManifiestoPdfService.TicketData(
                ruc, p.getSerie(), p.getCorrelativo(),
                origen, destino, fecha, hora,
                pasajeroNombre, tipoDoc, numDoc,
                numAsiento, p.getPrecioFinal(),
                placa, tipo
        );
    }

    private String str(Object o) { return o != null ? String.valueOf(o) : "—"; }
}
