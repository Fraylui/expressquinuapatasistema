package com.expressvraem.modules.auditoria.service;

import com.expressvraem.modules.auditoria.entity.Auditoria;
import com.expressvraem.modules.auditoria.repository.AuditoriaRepository;
import com.expressvraem.shared.utils.ExcelReportGenerator;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuditoriaService {

    private final AuditoriaRepository auditoriaRepository;
    private final ExcelReportGenerator excelGenerator;
    private final AuditoriaPdfService pdfService;

    public void registrar(Auditoria auditoria) {
        auditoriaRepository.save(auditoria);
    }

    public void registrar(Long usuarioId, String usuarioNombre, Long agenciaId,
                          String accion, String modulo, String entidad,
                          Long registroId, String datosDespues, String ip) {
        registrar(Auditoria.builder()
                .usuarioId(usuarioId).usuarioNombre(usuarioNombre)
                .agenciaId(agenciaId).accion(accion).modulo(modulo).entidad(entidad)
                .registroId(registroId).datosDespues(datosDespues).ip(ip).build());
    }

    public Page<Auditoria> buscar(Long usuarioId, String q, String modulo, String accion,
                                   Long agenciaId, LocalDateTime desde, LocalDateTime hasta,
                                   String ip, Long registroId, Pageable pageable) {
        Specification<Auditoria> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (usuarioId   != null) predicates.add(cb.equal(root.get("usuarioId"), usuarioId));
            if (registroId  != null) predicates.add(cb.equal(root.get("registroId"), registroId));
            if (q != null && !q.isBlank()) {
                String pattern = "%" + q.toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("usuarioNombre")), pattern),
                    cb.like(cb.lower(root.get("modulo")),        pattern),
                    cb.like(cb.lower(root.get("entidad")),       pattern),
                    cb.like(cb.lower(root.get("ip")),            pattern)
                ));
            }
            if (modulo != null)    predicates.add(cb.equal(root.get("modulo"), modulo));
            if (accion != null)    predicates.add(cb.equal(root.get("accion"), accion));
            if (agenciaId != null) predicates.add(cb.equal(root.get("agenciaId"), agenciaId));
            if (desde != null)     predicates.add(cb.greaterThanOrEqualTo(root.get("fecha"), desde));
            if (hasta != null)     predicates.add(cb.lessThanOrEqualTo(root.get("fecha"), hasta));
            if (ip != null && !ip.isBlank())
                predicates.add(cb.like(root.get("ip"), "%" + ip + "%"));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        Page<Auditoria> page = auditoriaRepository.findAll(spec, pageable);
        page.getContent().forEach(a -> a.setDetalle(generarDetalle(a)));
        return page;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getResumenHoy(Long agenciaId) {
        LocalDateTime inicioHoy = LocalDate.now().atStartOfDay();
        LocalDateTime finHoy    = inicioHoy.plusDays(1);

        List<Object[]> rows = auditoriaRepository.countByAccionGrouped(agenciaId, inicioHoy, finHoy);
        Map<String, Long> byAccion = new HashMap<>();
        long total = 0;
        for (Object[] r : rows) {
            String accion = r[0] != null ? String.valueOf(r[0]) : "OTRO";
            long cnt = ((Number) r[1]).longValue();
            byAccion.put(accion, cnt);
            total += cnt;
        }

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("total",   total);
        m.put("inserts", byAccion.getOrDefault("INSERT",        0L));
        m.put("updates", byAccion.getOrDefault("UPDATE",        0L));
        m.put("deletes", byAccion.getOrDefault("DELETE",        0L));
        m.put("logins",  byAccion.getOrDefault("LOGIN",         0L));
        m.put("fallidos",byAccion.getOrDefault("LOGIN_FALLIDO", 0L));
        return m;
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getActividad(Long agenciaId, String periodo) {
        boolean esSemana = "semana".equalsIgnoreCase(periodo);
        List<String> acciones = List.of("INSERT", "UPDATE", "DELETE", "LOGIN", "LOGIN_FALLIDO");

        if (esSemana) {
            Map<String, Map<String, Long>> porDia = new LinkedHashMap<>();
            for (int i = 6; i >= 0; i--) {
                String key = LocalDate.now().minusDays(i).toString();
                Map<String, Long> counts = new LinkedHashMap<>();
                acciones.forEach(a -> counts.put(a, 0L));
                porDia.put(key, counts);
            }
            List<Object[]> rows = auditoriaRepository.countByDiaAndAccion(
                    agenciaId,
                    LocalDate.now().minusDays(6).atStartOfDay(),
                    LocalDateTime.now());
            for (Object[] r : rows) {
                String dia    = String.valueOf(r[0]);   // "yyyy-MM-dd"
                String accion = String.valueOf(r[1]);
                long cnt      = ((Number) r[2]).longValue();
                if (porDia.containsKey(dia) && acciones.contains(accion))
                    porDia.get(dia).put(accion, cnt);
            }
            return porDia.entrySet().stream().map(e -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("label", e.getKey().substring(5).replace("-", "/"));
                row.putAll(e.getValue());
                return row;
            }).collect(Collectors.toList());

        } else {
            Map<Integer, Map<String, Long>> porHora = new LinkedHashMap<>();
            for (int h = 0; h < 24; h++) {
                Map<String, Long> counts = new LinkedHashMap<>();
                acciones.forEach(a -> counts.put(a, 0L));
                porHora.put(h, counts);
            }
            List<Object[]> rows = auditoriaRepository.countByHoraAndAccion(
                    agenciaId,
                    LocalDate.now().atStartOfDay(),
                    LocalDate.now().plusDays(1).atStartOfDay());
            for (Object[] r : rows) {
                int hora      = ((Number) r[0]).intValue();
                String accion = String.valueOf(r[1]);
                long cnt      = ((Number) r[2]).longValue();
                if (acciones.contains(accion)) porHora.get(hora).put(accion, cnt);
            }
            return porHora.entrySet().stream().map(e -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("label", String.format("%02d:00", e.getKey()));
                row.putAll(e.getValue());
                return row;
            }).collect(Collectors.toList());
        }
    }

    public byte[] exportarExcel(Long agenciaId, LocalDateTime desde, LocalDateTime hasta) throws IOException {
        List<Auditoria> logs = auditoriaRepository.findByAgenciaIdAndFechaBetweenOrderByFechaDesc(agenciaId, desde, hasta);
        logs.forEach(a -> a.setDetalle(generarDetalle(a)));
        List<Map<String, Object>> datos = logs.stream().map(a -> Map.<String, Object>of(
                "fecha",    a.getFecha().toString(),
                "usuario",  a.getUsuarioNombre() != null ? a.getUsuarioNombre() : "",
                "modulo",   a.getModulo()         != null ? a.getModulo()        : "",
                "accion",   a.getAccion()          != null ? a.getAccion()        : "",
                "entidad",  a.getEntidad()          != null ? a.getEntidad()       : "",
                "registroId", a.getRegistroId()     != null ? a.getRegistroId().toString() : "",
                "detalle",  a.getDetalle()           != null ? a.getDetalle()      : "",
                "ip",       a.getIp()               != null ? a.getIp()           : ""
        )).collect(Collectors.toList());
        return excelGenerator.generarReporteAuditoria(datos);
    }

    public byte[] exportarPdf(Long agenciaId, LocalDateTime desde, LocalDateTime hasta) {
        List<Auditoria> logs = auditoriaRepository.findByAgenciaIdAndFechaBetweenOrderByFechaDesc(agenciaId, desde, hasta);
        logs.forEach(a -> a.setDetalle(generarDetalle(a)));
        long total   = auditoriaRepository.countByAgenciaIdAndFechaBetween(agenciaId, desde, hasta);
        long inserts = auditoriaRepository.countByAgenciaIdAndFechaBetweenAndAccion(agenciaId, desde, hasta, "INSERT");
        long updates = auditoriaRepository.countByAgenciaIdAndFechaBetweenAndAccion(agenciaId, desde, hasta, "UPDATE");
        long deletes = auditoriaRepository.countByAgenciaIdAndFechaBetweenAndAccion(agenciaId, desde, hasta, "DELETE");
        long logins  = auditoriaRepository.countByAgenciaIdAndFechaBetweenAndAccion(agenciaId, desde, hasta, "LOGIN");
        Map<String, Object> resumen = Map.of(
                "total", total, "inserts", inserts, "updates", updates, "deletes", deletes, "logins", logins);
        return pdfService.generarReporte(logs, resumen, desde, hasta);
    }

    // ── helpers ──────────────────────────────────────────────────────────────────

    private String generarDetalle(Auditoria a) {
        String modulo  = a.getModulo()   != null ? a.getModulo()   : "SISTEMA";
        String entidad = a.getEntidad()   != null ? a.getEntidad()   : modulo;
        String ref     = a.getRegistroId() != null ? " #" + a.getRegistroId() : "";
        String usuario = a.getUsuarioNombre() != null ? a.getUsuarioNombre() : "desconocido";
        return switch (a.getAccion() != null ? a.getAccion() : "") {
            case "INSERT" -> "Registró " + entidad.toLowerCase() + ref + " en " + modulo;
            case "UPDATE" -> "Modificó " + entidad.toLowerCase() + ref + " en " + modulo;
            case "DELETE" -> "Eliminó "  + entidad.toLowerCase() + ref + " de " + modulo;
            case "LOGIN"  -> usuario + " inició sesión";
            case "LOGOUT" -> usuario + " cerró sesión";
            case "SELECT" -> "Consultó " + entidad.toLowerCase() + ref + " en " + modulo;
            default       -> (a.getAccion() != null ? a.getAccion() : "ACCIÓN") + " en " + modulo;
        };
    }
}
