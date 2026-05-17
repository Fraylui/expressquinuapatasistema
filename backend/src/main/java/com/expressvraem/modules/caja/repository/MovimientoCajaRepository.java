package com.expressvraem.modules.caja.repository;

import com.expressvraem.modules.caja.entity.MovimientoCaja;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MovimientoCajaRepository extends JpaRepository<MovimientoCaja, Long> {
    List<MovimientoCaja> findByCajaIdOrderByCreatedAtAsc(Long cajaId);
    List<MovimientoCaja> findByAgenciaIdAndTipoAndCreatedAtBetween(
            Long agenciaId, String tipo, LocalDateTime desde, LocalDateTime hasta);
}
