package com.expressvraem.modules.pasajes.repository;

import com.expressvraem.modules.pasajes.entity.Pasaje;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PasajeRepository extends JpaRepository<Pasaje, Long> {
    List<Pasaje> findByViajeId(Long viajeId);
    List<Pasaje> findByClienteId(Long clienteId);
    List<Pasaje> findByAgenciaIdAndFechaEmisionBetween(Long agenciaId, LocalDateTime desde, LocalDateTime hasta);

    @Query("SELECT p FROM Pasaje p WHERE p.viajeId = :viajeId AND p.estado != 'ANULADO'")
    List<Pasaje> findActivosByViajeId(Long viajeId);

    long countByViajeIdAndEstadoNot(Long viajeId, String estado);
}
