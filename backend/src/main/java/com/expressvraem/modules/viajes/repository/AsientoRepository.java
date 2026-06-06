package com.expressvraem.modules.viajes.repository;

import com.expressvraem.modules.viajes.entity.Asiento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AsientoRepository extends JpaRepository<Asiento, Long> {

    List<Asiento> findByViajeIdOrderByNumeroAsc(Long viajeId);

    Optional<Asiento> findByViajeIdAndNumero(Long viajeId, Integer numero);

    List<Asiento> findByViajeIdAndEstado(Long viajeId, String estado);

    long countByViajeIdAndEstado(Long viajeId, String estado);

    void deleteByViajeId(Long viajeId);
}
