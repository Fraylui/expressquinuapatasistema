package com.expressvraem.modules.caja.repository;

import com.expressvraem.modules.caja.entity.MovimientoCaja;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MovimientoCajaRepository extends JpaRepository<MovimientoCaja, Long> {
    List<MovimientoCaja> findByCajaIdOrderByCreatedAtAsc(Long cajaId);
    List<MovimientoCaja> findByCajaIdOrderByCreatedAtDesc(Long cajaId);

    @Query("SELECT m FROM MovimientoCaja m WHERE (:agenciaId IS NULL OR m.agenciaId = :agenciaId) AND m.tipo = :tipo AND m.createdAt BETWEEN :desde AND :hasta")
    List<MovimientoCaja> findByAgenciaIdOptionalAndTipoAndCreatedAtBetween(
            @Param("agenciaId") Long agenciaId, @Param("tipo") String tipo,
            @Param("desde") LocalDateTime desde, @Param("hasta") LocalDateTime hasta);

    List<MovimientoCaja> findByAgenciaIdAndTipoAndCreatedAtBetween(
            Long agenciaId, String tipo, LocalDateTime desde, LocalDateTime hasta);

    List<MovimientoCaja> findByAgenciaIdAndCreatedAtBetween(Long agenciaId, LocalDateTime desde, LocalDateTime hasta);

    List<MovimientoCaja> findByCreatedAtBetween(LocalDateTime desde, LocalDateTime hasta);

    @Query("SELECT COUNT(m) FROM MovimientoCaja m WHERE m.cajaId = :cajaId AND m.referenciaTipo = :refTipo")
    long countByCajaIdAndReferenciaTipo(@Param("cajaId") Long cajaId, @Param("refTipo") String refTipo);

    @Query("SELECT SUM(m.monto) FROM MovimientoCaja m WHERE m.cajaId = :cajaId AND m.referenciaTipo = :refTipo")
    BigDecimal sumMontoByCajaIdAndReferenciaTipo(@Param("cajaId") Long cajaId, @Param("refTipo") String refTipo);

    /** Una sola query por caja: reemplaza las 6 llamadas count/sum separadas. */
    @Query("SELECT m.referenciaTipo, COUNT(m), SUM(m.monto) FROM MovimientoCaja m WHERE m.cajaId = :cajaId GROUP BY m.referenciaTipo")
    List<Object[]> aggregateStatsByCajaId(@Param("cajaId") Long cajaId);

    /** Versión batch para historial: evita N+1 en páginas de 30 turnos. */
    @Query("SELECT m.cajaId, m.referenciaTipo, COUNT(m), SUM(m.monto) FROM MovimientoCaja m WHERE m.cajaId IN :cajaIds GROUP BY m.cajaId, m.referenciaTipo")
    List<Object[]> aggregateStatsByCajaIdIn(@Param("cajaIds") List<Long> cajaIds);
}
