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
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuditoriaService {

    private final AuditoriaRepository auditoriaRepository;
    private final ExcelReportGenerator excelGenerator;

    public void registrar(Auditoria auditoria) {
        auditoriaRepository.save(auditoria);
    }

    public Page<Auditoria> buscar(Long usuarioId, String modulo, String accion,
                                   Long agenciaId, LocalDateTime desde,
                                   LocalDateTime hasta, Pageable pageable) {
        Specification<Auditoria> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (usuarioId != null) predicates.add(cb.equal(root.get("usuarioId"), usuarioId));
            if (modulo != null)    predicates.add(cb.equal(root.get("modulo"), modulo));
            if (accion != null)    predicates.add(cb.equal(root.get("accion"), accion));
            if (agenciaId != null) predicates.add(cb.equal(root.get("agenciaId"), agenciaId));
            if (desde != null)     predicates.add(cb.greaterThanOrEqualTo(root.get("fecha"), desde));
            if (hasta != null)     predicates.add(cb.lessThanOrEqualTo(root.get("fecha"), hasta));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return auditoriaRepository.findAll(spec, pageable);
    }

    public Map<String, Object> getResumenHoy(Long agenciaId) {
        LocalDateTime inicioHoy = LocalDate.now().atStartOfDay();
        long total = auditoriaRepository.countByAgenciaIdAndFechaAfter(agenciaId, inicioHoy);
        long inserts = auditoriaRepository.countByAgenciaIdAndFechaAfterAndAccion(agenciaId, inicioHoy, "INSERT");
        long updates = auditoriaRepository.countByAgenciaIdAndFechaAfterAndAccion(agenciaId, inicioHoy, "UPDATE");
        long deletes = auditoriaRepository.countByAgenciaIdAndFechaAfterAndAccion(agenciaId, inicioHoy, "DELETE");

        return Map.of(
                "total", total,
                "inserts", inserts,
                "updates", updates,
                "deletes", deletes
        );
    }

    public byte[] exportarLogs(Long agenciaId, LocalDateTime desde, LocalDateTime hasta) throws IOException {
        List<Auditoria> logs = auditoriaRepository.findByFechaBetween(desde, hasta);
        List<Map<String, Object>> datos = logs.stream().map(a -> Map.<String, Object>of(
                "codigo", a.getId().toString(),
                "fecha", a.getFecha().toString(),
                "pasajero", a.getUsuarioNombre() != null ? a.getUsuarioNombre() : "",
                "dni", a.getModulo() != null ? a.getModulo() : "",
                "ruta", a.getAccion() != null ? a.getAccion() : "",
                "asiento", a.getEntidad() != null ? a.getEntidad() : "",
                "precio", "0"
        )).collect(Collectors.toList());

        return excelGenerator.generarReporteVentas(datos);
    }
}
