package com.expressvraem.modules.caja.repository;

import com.expressvraem.modules.caja.entity.EntregaEfectivo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface EntregaEfectivoRepository extends JpaRepository<EntregaEfectivo, Long> {

    List<EntregaEfectivo> findByAgenciaIdOrderByFechaEntregaDesc(Long agenciaId);

    List<EntregaEfectivo> findAllByOrderByFechaEntregaDesc();

    List<EntregaEfectivo> findByEstadoOrderByFechaEntregaDesc(String estado);

    long countByAgenciaId(Long agenciaId);

    /** Total declarado en entregas vigentes (todo menos ANULADA) de una agencia. */
    @Query("SELECT COALESCE(SUM(e.montoDeclarado), 0) FROM EntregaEfectivo e " +
           "WHERE e.agenciaId = :agenciaId AND e.estado <> 'ANULADA'")
    BigDecimal sumDeclaradoVigente(@Param("agenciaId") Long agenciaId);

    Optional<EntregaEfectivo> findFirstByAgenciaIdAndEstadoNotOrderByFechaEntregaDesc(
            Long agenciaId, String estadoExcluido);
}
