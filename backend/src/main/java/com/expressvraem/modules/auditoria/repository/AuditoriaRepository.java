package com.expressvraem.modules.auditoria.repository;

import com.expressvraem.modules.auditoria.entity.Auditoria;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AuditoriaRepository extends JpaRepository<Auditoria, Long>, JpaSpecificationExecutor<Auditoria> {
    List<Auditoria> findByUsuarioId(Long usuarioId);
    List<Auditoria> findByModulo(String modulo);
    List<Auditoria> findByFechaBetween(LocalDateTime desde, LocalDateTime hasta);
    List<Auditoria> findByAccion(String accion);
    long countByAgenciaIdAndFechaAfter(Long agenciaId, LocalDateTime desde);
    long countByAgenciaIdAndFechaAfterAndAccion(Long agenciaId, LocalDateTime desde, String accion);
    long countByAgenciaIdAndFechaBetween(Long agenciaId, LocalDateTime desde, LocalDateTime hasta);
    long countByAgenciaIdAndFechaBetweenAndAccion(Long agenciaId, LocalDateTime desde, LocalDateTime hasta, String accion);
    List<Auditoria> findByAgenciaIdAndFechaBetweenOrderByFechaDesc(Long agenciaId, LocalDateTime desde, LocalDateTime hasta);

    /** Una query GROUP BY en lugar de 5 queries de count. */
    @Query("SELECT a.accion, COUNT(a) FROM Auditoria a " +
           "WHERE (:agenciaId IS NULL OR a.agenciaId = :agenciaId) " +
           "AND a.fecha BETWEEN :desde AND :hasta GROUP BY a.accion")
    List<Object[]> countByAccionGrouped(
            @Param("agenciaId") Long agenciaId,
            @Param("desde") LocalDateTime desde,
            @Param("hasta") LocalDateTime hasta);

    /** Actividad por día (semana): GROUP BY fecha + accion en SQL. */
    @Query(value =
           "SELECT CAST(DATE(fecha) AS VARCHAR), accion, COUNT(*) " +
           "FROM auditoria " +
           "WHERE (CAST(:agId AS BIGINT) IS NULL OR agencia_id = :agId) " +
           "AND fecha BETWEEN :desde AND :hasta " +
           "AND accion IN ('INSERT','UPDATE','DELETE','LOGIN','LOGIN_FALLIDO') " +
           "GROUP BY DATE(fecha), accion ORDER BY DATE(fecha)",
           nativeQuery = true)
    List<Object[]> countByDiaAndAccion(
            @Param("agId") Long agenciaId,
            @Param("desde") LocalDateTime desde,
            @Param("hasta") LocalDateTime hasta);

    /** Actividad por hora (hoy): GROUP BY hora + accion en SQL. */
    @Query(value =
           "SELECT CAST(EXTRACT(HOUR FROM fecha) AS INT), accion, COUNT(*) " +
           "FROM auditoria " +
           "WHERE (CAST(:agId AS BIGINT) IS NULL OR agencia_id = :agId) " +
           "AND fecha BETWEEN :desde AND :hasta " +
           "AND accion IN ('INSERT','UPDATE','DELETE','LOGIN','LOGIN_FALLIDO') " +
           "GROUP BY EXTRACT(HOUR FROM fecha), accion ORDER BY EXTRACT(HOUR FROM fecha)",
           nativeQuery = true)
    List<Object[]> countByHoraAndAccion(
            @Param("agId") Long agenciaId,
            @Param("desde") LocalDateTime desde,
            @Param("hasta") LocalDateTime hasta);
}
