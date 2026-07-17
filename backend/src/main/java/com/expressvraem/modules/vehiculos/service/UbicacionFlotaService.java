package com.expressvraem.modules.vehiculos.service;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Ubicación derivada de vehículos y conductores: el sistema no tiene GPS,
 * pero el destino del último viaje dice dónde quedó cada uno.
 *
 *   - Último viaje EN_RUTA      → "En ruta a {destino}"
 *   - Último viaje COMPLETADO   → "{destino}"
 *   - Sin viajes registrados    → ciudad de la sede principal (o null)
 *
 * Es informativo: avisa al operador al programar, nunca bloquea (el carro
 * puede haberse movido sin viaje registrado).
 */
@Service
@RequiredArgsConstructor
public class UbicacionFlotaService {

    private final EntityManager entityManager;

    public Map<Long, String> ubicacionVehiculos() {
        return ubicacionPor("vehiculo_id");
    }

    public Map<Long, String> ubicacionConductores() {
        return ubicacionPor("conductor_id");
    }

    /** Ciudad de la sede principal — ubicación por defecto de la flota sin viajes. */
    public String ciudadSedePrincipal() {
        try {
            Object ciudad = entityManager.createNativeQuery(
                    "SELECT ciudad FROM agencias WHERE es_sede_principal = true LIMIT 1")
                    .getSingleResult();
            return ciudad != null ? String.valueOf(ciudad) : null;
        } catch (Exception e) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<Long, String> ubicacionPor(String columna) {
        Map<Long, String> resultado = new HashMap<>();
        try {
            List<Object[]> rows = (List<Object[]>) entityManager.createNativeQuery(
                    "SELECT t." + columna + ", t.estado, r.destino FROM (" +
                    "  SELECT v.*, ROW_NUMBER() OVER (" +
                    "      PARTITION BY v." + columna +
                    "      ORDER BY COALESCE(v.fecha_hora_arr, v.fecha_hora_sal) DESC, v.id DESC) rn" +
                    "  FROM viajes v WHERE v.estado IN ('EN_RUTA','COMPLETADO')" +
                    ") t JOIN rutas r ON r.id = t.ruta_id WHERE t.rn = 1")
                    .getResultList();
            for (Object[] r : rows) {
                if (r[0] == null) continue;
                Long id      = ((Number) r[0]).longValue();
                String dest  = String.valueOf(r[2]);
                resultado.put(id, "EN_RUTA".equals(String.valueOf(r[1])) ? "En ruta a " + dest : dest);
            }
        } catch (Exception ignored) {}
        return resultado;
    }
}
