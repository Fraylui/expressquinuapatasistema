package com.expressvraem.modules.tarifas.repository;

import com.expressvraem.modules.tarifas.entity.Tarifa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TarifaRepository extends JpaRepository<Tarifa, Long> {

    List<Tarifa> findByAgenciaId(Long agenciaId);

    List<Tarifa> findByAgenciaIdAndVigenteTrue(Long agenciaId);

    List<Tarifa> findByVigenteTrue();

    @Query("SELECT t FROM Tarifa t WHERE t.vigente = true AND t.rutaId = :rutaId AND t.tipoVehiculo = :tipo")
    List<Tarifa> findVigenteByRutaAndTipo(@Param("rutaId") Long rutaId, @Param("tipo") String tipo);

    /**
     * Tarifa vigente para ruta+tipo respetando temporada: la tarifa cuya temporada
     * activa cubre la fecha de hoy va primero; la general (sin temporada) queda como
     * fallback. Las tarifas de temporadas fuera de rango se excluyen.
     */
    @Query(value = "SELECT t.* FROM tarifas t " +
           "LEFT JOIN temporadas tp ON tp.id = t.temporada_id " +
           "WHERE t.vigente = true AND t.ruta_id = :rutaId AND t.tipo_vehiculo = :tipo " +
           "AND (t.temporada_id IS NULL OR (tp.activo = true AND CURRENT_DATE BETWEEN tp.fecha_ini AND tp.fecha_fin)) " +
           "ORDER BY CASE WHEN t.temporada_id IS NULL THEN 1 ELSE 0 END",
           nativeQuery = true)
    List<Tarifa> findVigenteEnTemporada(@Param("rutaId") Long rutaId, @Param("tipo") String tipo);

    @Query("SELECT t FROM Tarifa t WHERE t.vigente = true " +
           "AND t.rutaId = :rutaId AND t.tipoVehiculo = :tipo " +
           "AND t.agenciaId = :agenciaId AND t.id != :excludeId")
    List<Tarifa> findVigenteConflicto(@Param("rutaId") Long rutaId,
                                      @Param("tipo") String tipo,
                                      @Param("agenciaId") Long agenciaId,
                                      @Param("excludeId") Long excludeId);

    List<Tarifa> findByAgenciaIdAndRutaId(Long agenciaId, Long rutaId);
}
