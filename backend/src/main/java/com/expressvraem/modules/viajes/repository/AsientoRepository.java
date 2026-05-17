package com.expressvraem.modules.viajes.repository;

import com.expressvraem.modules.viajes.entity.Asiento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AsientoRepository extends JpaRepository<Asiento, Long> {
    List<Asiento> findByViajeIdOrderByNumeroAsc(Long viajeId);
}
