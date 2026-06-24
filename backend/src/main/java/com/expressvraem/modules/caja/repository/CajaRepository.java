package com.expressvraem.modules.caja.repository;

import com.expressvraem.modules.caja.entity.Caja;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CajaRepository extends JpaRepository<Caja, Long> {
    List<Caja> findByEstado(String estado);
    Optional<Caja> findByUsuarioIdAndEstado(Long usuarioId, String estado);
    boolean existsByUsuarioIdAndEstado(Long usuarioId, String estado);
    List<Caja> findByAgenciaIdAndEstado(Long agenciaId, String estado);
    List<Caja> findByUsuarioIdOrderByFechaAperturaDesc(Long usuarioId);
    List<Caja> findByAgenciaIdOrderByFechaAperturaDesc(Long agenciaId);
    Page<Caja> findByUsuarioIdOrderByFechaAperturaDesc(Long usuarioId, Pageable pageable);
    Page<Caja> findByAgenciaIdOrderByFechaAperturaDesc(Long agenciaId, Pageable pageable);
    Page<Caja> findAllByOrderByFechaAperturaDesc(Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Caja c WHERE c.id = :id")
    Optional<Caja> findByIdForUpdate(@Param("id") Long id);

    /** Efectivo físico que quedó en la agencia: suma de cierres de todos los turnos cerrados. */
    @Query("SELECT COALESCE(SUM(c.montoCierre), 0) FROM Caja c " +
           "WHERE c.agenciaId = :agenciaId AND c.estado = 'CERRADA'")
    java.math.BigDecimal sumMontoCierreByAgencia(@Param("agenciaId") Long agenciaId);
}
