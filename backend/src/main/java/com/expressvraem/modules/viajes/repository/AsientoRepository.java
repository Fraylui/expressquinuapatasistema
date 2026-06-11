package com.expressvraem.modules.viajes.repository;

import com.expressvraem.modules.viajes.entity.Asiento;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AsientoRepository extends JpaRepository<Asiento, Long> {

    List<Asiento> findByViajeIdOrderByNumeroAsc(Long viajeId);

    Optional<Asiento> findByViajeIdAndNumero(Long viajeId, Integer numero);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Asiento a WHERE a.viajeId = :viajeId AND a.numero = :numero")
    Optional<Asiento> findByViajeIdAndNumeroForUpdate(@Param("viajeId") Long viajeId,
                                                      @Param("numero") Integer numero);

    List<Asiento> findByViajeIdAndEstado(Long viajeId, String estado);

    long countByViajeIdAndEstado(Long viajeId, String estado);

    void deleteByViajeId(Long viajeId);
}
